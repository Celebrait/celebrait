import type { Express } from "express";
import FormData from "form-data";
import { storage } from "../storage";
import { resolveInsidePrompt } from "../prompts/resolver";
import { generateCardInBackground } from "../background-generator";
import {
  openai,
  convertBase64ToPngFile,
  applyWatermark,
  applyWatermarkToPngFile
} from "../utils/shared";

export function registerGenerationRoutes(app: Express): void {
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, cardId, systemPrompt } = req.body;

      if (!cardId) {
        return res.status(400).json({ message: "Card ID is required" });
      }

      if (!openai) {
        return res.status(503).json({ message: "AI service not available - API key required" });
      }

      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt || "You are Celebrait, a friendly AI assistant that helps users create custom greeting cards."
          },
          ...messages
        ],
        temperature: 0.9,
        max_tokens: 500
      });

      const response = completion.choices[0].message.content;

      // Update card with conversation data
      const conversationData = card.conversationData || {};
      const existingMessages = (conversationData as any)?.messages || [];
      const updatedConversationData = {
        ...conversationData,
        messages: [...existingMessages, ...messages, {
          role: "assistant",
          content: response
        }]
      };

      await storage.updateCard(cardId, {
        conversationData: updatedConversationData
      });

      res.json({ response });
    } catch (error: any) {
      res.status(500).json({ message: "Error processing chat: " + error.message });
    }
  });


  app.post("/api/generate-images", async (req, res) => {
    // Test hook for triggering safety errors (development only)
    if (process.env.NODE_ENV === 'development' && req.headers['x-test-trigger'] === 'safety_violation') {
      console.log('[TEST] Triggering safety error for testing');
      return res.status(400).json({
        error: 'Content moderation detected inappropriate content',
        isSafetyError: true,
        errorType: req.headers['x-test-error-type'] || 'children_photos'
      });
    }

    try {
      const { cardId, frontPrompt, insidePrompt, photoData, photoAnalysis } = req.body;

      console.log('Image generation request:', { cardId, frontPrompt, insidePrompt });

      if (!cardId || !frontPrompt) {
        return res.status(400).json({ message: "Card ID and front prompt are required" });
      }

      if (!openai) {
        return res.status(503).json({ message: "AI service not available - API key required" });
      }

      const card = await storage.getCard(cardId);
      if (!card) {
        console.log('Card not found for ID:', cardId);
        return res.status(404).json({ message: "Card not found" });
      }

      console.log('Found card:', card.id);

      // Generate front image using GPT-Image-1 model
      console.log('Using model: gpt-image-1.5 for front image');

      let frontImageGeneration;

      // CRITICAL UPDATE: All photo uploads now use detailed 8-step facial recreation prompt (PATH 2)
      // This eliminates simple prompts and ensures consistent high-quality results
      
      if (photoData) {
        // REDIRECT ALL PHOTO UPLOADS TO PATH 2: Detailed 8-step facial recreation
        console.log('🎯 REDIRECTING PHOTO UPLOADS TO PATH 2 - DETAILED FACIAL RECREATION');
        console.log('Photo upload detected - using detailed /api/edit-scene-gpt-image-1 endpoint');
        
        // Extract scene and style from the front prompt for PATH 2
        const imageDataArray = Array.isArray(photoData) ? photoData : [photoData];
        
        // Make internal call to the detailed PATH 2 endpoint
        try {
          const sceneEditResponse = await fetch(`${req.protocol}://${req.get('host')}/api/edit-scene-gpt-image-1`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': req.headers.authorization || ''
            },
            body: JSON.stringify({
              imageDataArray,
              scenePrompt: frontPrompt,
              cardText: '', // Will be extracted from prompt
              includeText: true,
              userArtStyle: 'ai_decide',
              userClothing: ''
            })
          });
          
          if (!sceneEditResponse.ok) {
            throw new Error(`PATH 2 endpoint failed: ${sceneEditResponse.status}`);
          }
          
          const sceneEditResult = await sceneEditResponse.json();
          
          // Convert PATH 2 response to expected format
          frontImageGeneration = {
            data: [{
              url: sceneEditResult.imageUrl || sceneEditResult.transformedImageUrl
            }]
          };
          
          console.log('🎯 SUCCESS: Photo upload processed through PATH 2 detailed facial recreation');
        } catch (path2Error: any) {
          console.log('PATH 2 detailed processing failed, falling back to text generation:', path2Error.message);
          
          // Fallback to standard text-only generation
          frontImageGeneration = await openai.images.generate({
            model: "gpt-image-1.5",
            prompt: frontPrompt,
            n: 1,
            size: "1024x1024",
            quality: "high"
          });
        }
      } else {
        // Standard text-only generation
        frontImageGeneration = await openai.images.generate({
          model: "gpt-image-1.5",
          prompt: frontPrompt,
          n: 1,
          size: "1024x1024",
          quality: "high"
        });
      }

      const responseData = frontImageGeneration as any;
      console.log('Response keys:', Object.keys(responseData));
      console.log('Has images property:', 'images' in responseData);
      if (responseData.images) {
        console.log('Images array length:', responseData.images.length);
        console.log('First image exists:', !!responseData.images[0]);
        if (responseData.images[0]) {
          console.log('First image data type:', typeof responseData.images[0]);
          console.log('First image data length:', responseData.images[0].length);
        }
      }

      let insideImageUrl = null;
      let frontImageUrl = null;

      // Extract image data FIRST (dall-e-3 returns base64 data in 'data' array)
      const frontResponse = frontImageGeneration as any;
      console.log('Checking frontResponse.data:', !!frontResponse.data);
      console.log('frontResponse.data type:', typeof frontResponse.data);

      if (frontResponse.data && Array.isArray(frontResponse.data) && frontResponse.data.length > 0) {
        const imageData = frontResponse.data[0];
        console.log('Image data type:', typeof imageData);
        console.log('Image data keys:', Object.keys(imageData));

        // The data might be in imageData.b64_json or imageData.url
        if (typeof imageData === 'string') {
          frontImageUrl = `data:image/png;base64,${imageData}`;
        } else if (imageData.b64_json) {
          frontImageUrl = `data:image/png;base64,${imageData.b64_json}`;
        } else if (imageData.url) {
          frontImageUrl = imageData.url;
        }
        console.log('Successfully extracted front image data from data array');
      } else {
        console.log('Failed to find data array in frontResponse');
      }

      // Generate inside image if provided, using direct style reference approach
      if (insidePrompt && frontImageUrl) {
        console.log('Generating inside card using direct GPT-Image-1 style reference approach');

        try {
          // Extract the message text from the inside prompt
          const messageMatch = insidePrompt.match(/"([^"]+)"/);
          const insideMessage = messageMatch ? messageMatch[1] : 'Happy Birthday!';

          // Use proper inside card prompt with comprehensive requirements
          const insideCardPrompt = `Square 1:1 aspect ratio design, full bleed with no borders or card edges visible, fill entire frame. DO NOT include any people, characters, or figures from the front card. "${insideMessage}" prominently displayed as the main focus with elegant typography. Reference this front card image for style consistency: same art style, same typography style exactly (font family, weight, text treatment), same color palette exactly (primary and accent colors). Include subtle visual reference points to overall scene atmosphere from front card, but nothing too imposing as text is the primary focus. New image must feel like it is part of the same design family with cohesive design language and visual consistency. Print-ready artwork, no card mockup visible.`;

          console.log('Using direct GPT-Image-1 style reference for inside card');

          // Convert front card image to buffer for GPT-Image-1 edits API
          const base64Data = frontImageUrl.replace(/^data:image\/[a-z]+;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');

          // Detect MIME type from the front card image
          const mimeMatch = frontImageUrl.match(/^data:image\/([a-z]+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'png';

          console.log('Front card image buffer size:', imageBuffer.length, 'bytes, MIME type:', mimeType);

          // Use form-data approach with GPT-Image-1 edits API
          const formData = new FormData();

          // Add image buffer with proper metadata
          formData.append('image', imageBuffer, {
            filename: `front-card.${mimeType}`,
            contentType: `image/${mimeType}`
          });
          formData.append('prompt', insideCardPrompt);
          formData.append('model', 'gpt-image-1.5');
          formData.append('n', '1');
          formData.append('size', '1024x1024');
          formData.append('quality', 'high');
          formData.append('moderation', 'low');

          const fetch = (await import('node-fetch')).default;
          const response = await fetch('https://api.openai.com/v1/images/edits', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              ...formData.getHeaders()
            },
            body: formData
          });

          if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: { message: errorText } };
            }
            throw new Error(`GPT-Image-1 API error: ${response.status} ${errorData.error?.message || 'Unknown error'}`);
          }

          const responseData = await response.json();

          if (responseData && (responseData as any).data && Array.isArray((responseData as any).data) && (responseData as any).data.length > 0) {
            const imageResult = (responseData as any).data[0];

            if (imageResult.b64_json) {
              insideImageUrl = `data:image/png;base64,${imageResult.b64_json}`;
              console.log('Generated inside card using direct style reference approach');
            } else if (imageResult.url) {
              insideImageUrl = imageResult.url;
              console.log('Generated inside card image URL:', imageResult.url);
            } else {
              throw new Error('No image data received from GPT-Image-1');
            }
          } else {
            throw new Error('Invalid response format from GPT-Image-1 API');
          }
        } catch (styleReferenceError: any) {
          console.log('Direct style reference approach failed:', styleReferenceError.message);
          // Skip inside card generation if it fails
          insideImageUrl = null;
        }
      }

      console.log('Extracted front image URL:', frontImageUrl ? 'Base64 data received' : 'No image data');
      console.log('Extracted inside image URL:', insideImageUrl ? 'Base64 data received' : 'No image data');

      // CRITICAL: PNG-ONLY WORKFLOW - Convert base64 to PNG immediately and use PNG files throughout
      let frontImagePngUrl = null;
      let insideImagePngUrl = null;
      
      if (frontImageUrl) {
        console.log('[PNG_ONLY] Converting front image to PNG and creating watermarked/unwatermarked versions...');
        
        // Step 1: Convert base64 to PNG file immediately (unwatermarked original)
        const unwatermarkedFrontPngUrl = await convertBase64ToPngFile(frontImageUrl, cardId, 'front_unwatermarked');
        console.log('[PNG_ONLY] Unwatermarked front PNG created:', unwatermarkedFrontPngUrl);
        
        // Step 2: Apply watermark to PNG file and create watermarked PNG file
        frontImagePngUrl = await applyWatermarkToPngFile(cardId, 'front_unwatermarked', 'front');
        console.log('[PNG_ONLY] Watermarked front PNG created:', frontImagePngUrl);
      }
      
      if (insideImageUrl) {
        console.log('[PNG_ONLY] Converting inside image to PNG and creating watermarked/unwatermarked versions...');
        
        // Step 1: Convert base64 to PNG file immediately (unwatermarked original)
        const unwatermarkedInsidePngUrl = await convertBase64ToPngFile(insideImageUrl, cardId, 'inside_unwatermarked');
        console.log('[PNG_ONLY] Unwatermarked inside PNG created:', unwatermarkedInsidePngUrl);
        
        // Step 2: Apply watermark to PNG file and create watermarked PNG file
        insideImagePngUrl = await applyWatermarkToPngFile(cardId, 'inside_unwatermarked', 'inside');
        console.log('[PNG_ONLY] Watermarked inside PNG created:', insideImagePngUrl);
      }

      // Update card with watermarked PNG file URLs (for preview)
      const updatedCard = await storage.updateCard(cardId, {
        frontImageUrl: frontImagePngUrl, // Store watermarked PNG file URL for preview
        insideImageUrl: insideImagePngUrl, // Store watermarked PNG file URL for preview
        status: 'completed'
      });

      // No auto-email on generation complete — the Studio flow
      // sends recipient + sender emails on order-paid, not on
      // card-ready. Legacy "card preview" path retired 2026-04-21.
      res.json(updatedCard);
    } catch (error: any) {
      res.status(500).json({ message: "Error generating images: " + error.message });
    }
  });


  app.post("/api/edit-scene-gpt-image-1", async (req, res) => {
    if (!openai) {
      return res.status(500).json({ message: "OpenAI API key not configured" });
    }

    try {
      const { imageData, imageDataArray, scenePrompt, style, includeText, cardText, userClothing, userArtStyle } = req.body;

      // ALWAYS FORCE SQUARE ASPECT RATIO - IGNORE ANY SIZE PARAMETER
      const size = '1024x1024';

      // Support both single image (legacy) and multiple images (new)
      const imagesToProcess = imageDataArray || (imageData ? [imageData] : []);

      if (imagesToProcess.length === 0 || !scenePrompt) {
        return res.status(400).json({ message: "Image data and scene description are required" });
      }

      console.log('🎯 STARTING /api/edit-scene-gpt-image-1 - SCENE EDIT REQUEST');
      console.log('Processing GPT-Image-1 scene edit request with scene:', scenePrompt);
      console.log('Art style:', userArtStyle || 'AI_DECIDE');
      console.log('Number of images:', imagesToProcess.length);
      console.log('Scene prompt:', scenePrompt);
      console.log('Style:', style);
      console.log('Include text:', includeText);
      console.log('Card text:', cardText);
      console.log('Requested size:', size);

      // Use detected person count if provided, otherwise fall back to image count
      // No longer need to detect people count since we use naturally inclusive language
      
      // Build the complete prompt using naturally inclusive language
      const characterText = 'characters from the reference images';
      // ALWAYS FORCE SQUARE ASPECT RATIO - NO PORTRAIT ALLOWED
      const aspectDescription = 'MANDATORY: Create a perfectly SQUARE composition with equal width and height - NOT portrait, NOT landscape. Full bleed square design with no borders, fill entire square frame.';
      const formatInstruction = 'COMPOSE FOR SQUARE FORMAT - ensure all elements fit within a square boundary';
      
      const faceAnalysisText = 'ANALYZE EACH FACE IN DETAIL';
      const faceRecreationText = 'RECREATE EACH IDENTICAL FACE';
      const characterPositioning = 'Place the characters';
      const characterPoses = 'Give the characters';
      const clothingInstruction = 'dress the characters appropriately';
      const positioningInstruction = 'Reimagine character positioning and interactions';

      // Build clothing requirements section
      let clothingSection = '';
      if (userClothing && userClothing.trim()) {
        clothingSection = `CLOTHING REQUIREMENTS: The scene description includes specific clothing requirements. Dress the character(s) exactly as described: ${userClothing}`;
      } else {
        clothingSection = `CLOTHING REQUIREMENTS: Choose scene-appropriate clothing that fits the new environment and activity. Change the clothing completely from the reference photo to match the scenario while maintaining identical faces only.`;
      }

      // Build art style section
      let styleSection = '';
      if (userArtStyle && userArtStyle.trim() && userArtStyle !== 'ai_decide') {
        styleSection = `ARTISTIC STYLE APPLICATION: Apply the user-specified artistic style: ${userArtStyle}. Render the entire image consistently in this style while maintaining high artistic quality and visual cohesion.`;
      } else {
        styleSection = `ARTISTIC STYLE APPLICATION: DYNAMIC STYLE SELECTION: Analyze the scene description and intelligently choose the most appropriate artistic style that best complements the mood, atmosphere, setting, and emotional tone of this specific scene.

Consider artistic styles such as:
- Watercolor painting (for soft, dreamy, romantic scenes)
- Oil painting (for classical, elegant, formal celebrations)
- Digital illustration (for modern, contemporary settings)
- Fantasy art (for magical, mystical, fairytale scenes)
- Storybook illustration (for whimsical, children's book-style scenes)
- Impressionistic (for atmospheric, mood-focused scenes)
- Contemporary art (for urban, trendy, modern celebrations)
- Realistic photography style (for authentic, documentary-style moments)
- Vintage illustration (for retro, nostalgic, classic scenes)
- Comic book style (for dynamic, energetic, fun celebrations)
- Minimalist design (for clean, simple, sophisticated scenes)
- Renaissance painting (for grand, ornate, classical scenes)
- Anime/manga style (for vibrant, expressive, youthful scenes)
- Art nouveau (for decorative, elegant, artistic scenes)

Choose the single artistic style that creates the most contextually appropriate, visually stunning, and emotionally resonant result for this specific scene.`;
      }

      let fullPrompt = `MANDATORY: Create a perfectly SQUARE 1024x1024 composition with equal width and height - NOT portrait, NOT landscape. Full bleed square design with no borders, fill entire square frame. ABSOLUTE PRIORITY: FACIAL ACCURACY FIRST - Before applying any artistic style, the EXACT facial likeness from the reference photo(s) must be preserved with absolute precision in the new scene BUT with new expressions to match the new scene. Ensure that the characters always look happy to be a part of the new scene in a natural way to fit the new scene.

MANDATORY FACIAL RECREATION REQUIREMENTS FOR ALL CHARACTERS IN THE REFERENCE PHOTO(S) (COMPLETE BEFORE ANY STYLING):
1) FACIAL STRUCTURE MATCH: Recreate the EXACT facial bone structure - same cheekbone height, same jawline angle, same forehead shape, same chin projection (but with new facial expression to match the new scene and mood)
2) EYE PRECISION: Match exact eye shape (almond, round, hooded), eye spacing, eyelid fold pattern, iris color, eyebrow shape and arch
3) NOSE ACCURACY: Replicate precise nose bridge width, nostril shape, nose tip definition, any bumps or unique nose characteristics  
4) MOUTH DUPLICATION: Copy exact lip fullness, mouth width, corner shape, any asymmetries or distinctive mouth features
5) SKIN MATCHING: Preserve exact skin tone, texture, any blemishes, freckles, moles, or distinctive skin characteristics
6) HAIR PRECISION: Match exact hair color, texture, natural growth patterns, hairline shape
7) DISTINCTIVE MARKS: Include any scars, dimples, laugh lines, or other identifying facial features
8) CRITICAL EXPRESSION CHANGE: DO NOT copy the original facial expression from the reference photo. You must create a COMPLETELY NEW facial expression that matches the mood and energy of the new scene

AFTER ESTABLISHING PERFECT LIKENESS - SCENE CREATION:
Create a completely new scene featuring the character(s) from the reference photo(s). CRITICAL: Ensure the characters facial expressions capture the mood of the new scene. DO NOT COPY the original expressions.

COMPOSITION RULES:
- Show the character(s) actively participating in the new scene, not just posing
- Include relevant background elements that tell the story of the scene
- Use full-body or three-quarter shots that tell the story of the scene
- Create immersive scene composition that showcases the environment
- SCENE-APPROPRIATE EXPRESSION: The character(s) must display a brand NEW facial expression that perfectly captures the energy and mood of this specific scene
- COMPLETELY IGNORE ORIGINAL PHOTO COMPOSITION: Do NOT copy the positioning, framing, or body placement from the reference photo. The reference is ONLY for facial features
- CREATIVE POSITIONING REQUIRED: Position character(s) in completely different positions that showcase the full scene context
- DYNAMIC POSES AND INTERACTIONS: Create completely new poses that are appropriate for the scene activity and energy level
- ENVIRONMENTAL INTEGRATION: Reimagine character positioning and interactions for the new environment to create an immersive scene composition

SCENE DESCRIPTION: ${scenePrompt}

${clothingSection}

${styleSection}`;
      // Add typography integration
      fullPrompt = `${fullPrompt}\n\nTYPOGRAPHY INTEGRATION: Naturally integrate text into the scene as part of the artistic composition - text should appear prominent on the image, carved into surfaces, written in natural elements, displayed on signs, or formed by scene elements, ensuring clear legibility of ALL letters while feeling like an organic part of the scene, rather than overlaid text.`;
      
      if (includeText && cardText && cardText.trim()) {
        fullPrompt = `${fullPrompt}. STRICT TEXT RESTRICTION: Add EXACTLY and ONLY the text "${cardText}" - ABSOLUTELY NO OTHER TEXT, WORDS, LETTERS, NUMBERS, SIGNS, LABELS, OR WRITING of any kind should appear anywhere in the image. CRITICAL: Do NOT overlay text on top of the image. Instead, naturally integrate ONLY this specific text into the scene as part of the artistic composition. The text should appear as if it belongs in this specific environment - carved into surfaces, written in natural elements, displayed on signs, formed by scene elements, or integrated into the background architecture. FORBIDDEN: Do not add any background text, signage, labels, captions, watermarks, logos, brand names, location names, or any other written content. Typography should match the chosen artistic style and complement the scene's natural elements. CRITICAL: All letters of the text should be legible within the square frame of the artwork. CRITICAL: DO NOT allow the text to be cropped off the screen in any way; all letters in the text MUST be readable with no cropping of the text whatsoever.`;
      }
      fullPrompt = `${fullPrompt}. High-quality artistic rendering, professional artwork.`;

      console.log('🎯 PATH 2 - DETAILED FACIAL RECREATION TO GPT-IMAGE-1:', fullPrompt);
      console.log('Complete prompt for scene editing:', fullPrompt);
      console.log('=== DEBUG: EXACT DETAILED FACIAL RECREATION PROMPT ===');
      console.log(fullPrompt);
      console.log('=== END DETAILED PROMPT ===');

      try {
        console.log('Making GPT-Image-1 scene edit API request using direct HTTP form-data');

        // Use form-data package for proper multipart form handling
        const formData = new FormData();

        // Add all images to the form data with image[] parameter names
        imagesToProcess.forEach((imageData: string, index: number) => {
          // Extract MIME type and base64 data
          const mimeMatch = imageData.match(/^data:image\/([a-z]+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'png';
          const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');

          console.log(`Image ${index + 1} buffer size:`, imageBuffer.length, 'bytes, MIME type:', mimeType);

          // Add image buffer with proper metadata using image[] parameter name
          formData.append('image[]', imageBuffer, {
            filename: `image${index + 1}.${mimeType}`,
            contentType: `image/${mimeType}`
          });
        });

        formData.append('prompt', fullPrompt);
        formData.append('model', 'gpt-image-1.5');
        formData.append('n', '1');
        formData.append('size', '1024x1024');
        formData.append('quality', 'high');
        formData.append('moderation', 'low');
        formData.append('background', 'auto');

        // Use node-fetch with proper FormData handling
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            ...formData.getHeaders()
          },
          body: formData
        });

        // Add timeout handling for GPT-Image-1 requests - increased for complex processing
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('GPT-Image-1 scene edit request timed out after 4 minutes - complex processing may take time')), 240000);
        });

        const responsePromise = (async () => {
          if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: { message: errorText } };
            }
            throw new Error(`GPT-Image-1 API error: ${response.status} ${errorData.error?.message || 'Unknown error'}`);
          }

          return await response.json();
        })();

        const responseData = await Promise.race([responsePromise, timeoutPromise]);

        console.log('GPT-Image-1 scene edit response received successfully');

        // Extract image URL from response
        let imageUrl: string = '';
        if (responseData && (responseData as any).data && Array.isArray((responseData as any).data) && (responseData as any).data.length > 0) {
          const imageResult = (responseData as any).data[0];

          if (imageResult.b64_json) {
            imageUrl = `data:image/png;base64,${imageResult.b64_json}`;
            console.log('Generated base64 image URL successfully');
          } else if (imageResult.url) {
            imageUrl = imageResult.url;
            console.log('Generated image URL:', imageResult.url);
          } else {
            throw new Error('No image data received from GPT-Image-1');
          }
        } else {
          throw new Error('Invalid response format from GPT-Image-1 API');
        }

        console.log('GPT-Image-1 scene editing completed successfully');

        // CRITICAL: PNG-ONLY WORKFLOW - Convert to PNG immediately and use PNG files throughout
        const { cardId } = req.body;
        
        if (cardId) {
          console.log('[PNG_ONLY] Converting scene image to PNG with OPTIMIZED parallel processing...');
          
          try {
            const pngStartTime = Date.now();
            
            // PERFORMANCE OPTIMIZATION: Run PNG operations in parallel
            const [unwatermarkedFrontPngUrl, frontImagePngUrl] = await Promise.all([
              // Step 1: Convert base64 to PNG file immediately (unwatermarked original)
              convertBase64ToPngFile(imageUrl, cardId, 'front_unwatermarked'),
              // Step 2: Apply watermark directly to base64 and save as PNG (parallel processing)
              (async () => {
                const watermarkedBase64 = await applyWatermark(imageUrl, 0.25);
                return await convertBase64ToPngFile(watermarkedBase64, cardId, 'front');
              })()
            ]);
            
            const totalPngDuration = Date.now() - pngStartTime;
            console.log(`[PNG_ONLY] OPTIMIZED front PNG processing completed in ${totalPngDuration}ms (parallel processing)`);
            console.log('[PNG_ONLY] Created unwatermarked front:', unwatermarkedFrontPngUrl);
            console.log('[PNG_ONLY] Created watermarked front:', frontImagePngUrl);
          
            res.json({ 
              imageUrl: frontImagePngUrl, // Return PNG file URL instead of Base64
              originalImageUrl: imageUrl, // Store original for secure access
              usage: (responseData as any).usage
            });
          } catch (pngError: any) {
            console.error('[PNG_ONLY] Error during PNG processing:', pngError);
            // Fallback to original response if PNG processing fails
            const watermarkedImageUrl = await applyWatermark(imageUrl, 0.25);
            console.log('PNG processing failed, using base64 watermark fallback');
            
            res.json({ 
              imageUrl: watermarkedImageUrl,
              originalImageUrl: imageUrl,
              usage: (responseData as any).usage
            });
          }
        } else {
          // Fallback for requests without cardId (legacy support)
          const watermarkedImageUrl = await applyWatermark(imageUrl, 0.25);
          console.log('Watermark applied to front image (legacy fallback)');
          
          res.json({ 
            imageUrl: watermarkedImageUrl,
            originalImageUrl: imageUrl,
            usage: (responseData as any).usage
          });
        }

      } catch (error: any) {
        console.error('GPT-Image-1 FormData scene edit error details:', error);

        // Handle specific API errors
        if (error.message?.includes('400')) {
          if (error.message?.includes('model') || error.message?.includes('model_not_found')) {
            throw new Error('GPT-Image-1 model is not available with your current OpenAI API access. This model may require special permissions.');
          } else if (error.message?.includes('multipart') || error.message?.includes('form-data')) {
            throw new Error('Image upload format error. Please ensure the image is valid.');
          } else {
            throw new Error(`GPT-Image-1 API error: ${error.message}`);
          }
        } else if (error.message?.includes('401')) {
          throw new Error('OpenAI API authentication failed. Please check your API key.');
        } else if (error.message?.includes('429')) {
          throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        } else if (error.message?.includes('500')) {
          throw new Error('OpenAI API server error. Please try again later.');
        } else {
          throw new Error(`GPT-Image-1 scene edit error: ${error.message || 'Unknown error'}`);
        }
      }

    } catch (error: any) {
      console.error('GPT-Image-1 scene edit error:', error);

      // Use enhanced error handler
      const { mapOpenAIError } = await import('../../shared/openaiErrorHandler');
      const mappedError = mapOpenAIError(error);
      
      console.log('🔍 MAPPED ERROR:', mappedError);

      res.status(mappedError.http).json({ 
        message: mappedError.userMessage, 
        isSafetyError: mappedError.kind === 'safety',
        errorType: mappedError.kind === 'safety' ? 'safety_filter' : mappedError.kind,
        errorKind: mappedError.kind,
        title: mappedError.title,
        techMessage: mappedError.techMessage,
        code: mappedError.code
      });
    }
  });


  app.post("/api/generate-inside-card", async (req, res) => {
    const requestStartTime = Date.now();
    console.log('[TIMING] Inside card generation request started');
    
    // Set longer timeout for this specific request
    req.setTimeout(600000); // 10 minute timeout
    res.setTimeout(600000); // 10 minute timeout
    
    if (!openai) {
      return res.status(500).json({ message: "OpenAI API key not configured" });
    }

    try {
      const { frontCardImage, insideText, artStyle, size = '1024x1024' } = req.body;

      if (!frontCardImage || !insideText) {
        return res.status(400).json({ message: "Front card image and inside text are required" });
      }

      // Validate size parameter
      if (!['1024x1024', '1024x1536'].includes(size)) {
        return res.status(400).json({ message: "Size must be either 1024x1024 or 1024x1536" });
      }

      console.log('Generating inside card using GPT-Image-1 image-to-image');
      console.log('Inside text:', insideText);
      console.log('Requested size:', size);

      // Handle both base64 data and PNG file URLs
      let imageBuffer: Buffer;
      let mimeType: string;
      
      if (frontCardImage.startsWith('data:image/')) {
        // Handle base64 data URLs
        const base64Data = frontCardImage.replace(/^data:image\/[a-z]+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
        const mimeMatch = frontCardImage.match(/^data:image\/([a-z]+);base64,/);
        mimeType = mimeMatch ? mimeMatch[1] : 'png';
      } else if (frontCardImage.startsWith('/images/')) {
        // Handle PNG file URLs - read the file from disk
        const fs = await import('fs');
        const path = await import('path');
        const filePath = path.join(process.cwd(), 'stored_images', frontCardImage.replace('/images/', ''));
        try {
          imageBuffer = await fs.promises.readFile(filePath);
          mimeType = 'png';
        } catch (error) {
          console.error('Error reading front card PNG file:', error);
          throw new Error('Failed to read front card image file');
        }
      } else {
        throw new Error('Invalid front card image format. Expected base64 data URL or PNG file URL');
      }

      console.log('Front card image buffer size:', imageBuffer.length, 'bytes, MIME type:', mimeType);

      // Parse inside message into structured greeting card components
      const parseInsideMessage = (text: string) => {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        // Look for greeting patterns (Dear X, Hi X, etc.)
        const greetingPatterns = /^(dear|hi|hello|hey)\s+[^,]+[,]?/i;
        // Look for signature patterns (Love X, From X, -X, etc.)
        const signaturePatterns = /^(love|from|yours|sincerely|best|cheers|xoxo|\-|♥)\s*.+$/i;
        
        let greeting = null;
        let message = [];
        let signature = null;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          if (i === 0 && greetingPatterns.test(line)) {
            greeting = line;
          } else if (i === lines.length - 1 && signaturePatterns.test(line)) {
            signature = line;
          } else if (signature === null && signaturePatterns.test(line)) {
            signature = line;
          } else {
            message.push(line);
          }
        }
        
        // If no structured components found, treat as simple message
        if (!greeting && !signature) {
          return null;
        }
        
        return {
          dear: greeting,
          message: message.join(' '),
          from: signature
        };
      };
      
      const structuredData = parseInsideMessage(insideText);
      console.log('Parsed inside message structure:', structuredData);
      
      // Resolve the active inside-card prompt from the Prompt Lab DB (with
      // hardcoded fallback if DB isn't seeded yet). See PROMPT_LAB_PLAN.md §4.
      const resolvedInside = await resolveInsidePrompt({
        insideText,
        artStyle: artStyle || 'artistic',
        structuredData: structuredData ?? undefined,
      });
      const insideCardPrompt = resolvedInside.text;

      console.log(
        `Inside card prompt (source=${resolvedInside.source}, templateId=${resolvedInside.templateId}, v=${resolvedInside.templateVersion}):`,
        insideCardPrompt,
      );

      // Use form-data approach with GPT-Image-1 edits API
      const formData = new FormData();

      // Add image buffer with proper metadata
      formData.append('image', imageBuffer, {
        filename: `front-card.${mimeType}`,
        contentType: `image/${mimeType}`
      });
      console.log('🎯 INSIDE CARD - EXACT PROMPT SENT TO GPT-IMAGE-1:');
      console.log('=== DEBUG: INSIDE CARD PROMPT START ===');
      console.log(insideCardPrompt);
      console.log('=== DEBUG: INSIDE CARD PROMPT END ===');
      
      formData.append('prompt', insideCardPrompt);
      formData.append('model', 'gpt-image-1.5');
      formData.append('n', '1');
      formData.append('size', size);
      formData.append('quality', 'high');
      formData.append('moderation', 'low');
      formData.append('background', 'auto');

      const fetch = (await import('node-fetch')).default;
      const apiStartTime = Date.now();
      console.log('[TIMING] Starting OpenAI API call...');
      
      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders()
        },
        body: formData
      });
      
      const apiDuration = Date.now() - apiStartTime;
      console.log(`[TIMING] OpenAI API call completed in ${apiDuration}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText } };
        }
        throw new Error(`GPT-Image-1 API error: ${response.status} ${errorData.error?.message || 'Unknown error'}`);
      }

      const responseData = await response.json();

      let imageUrl: string = '';
      if (responseData && (responseData as any).data && Array.isArray((responseData as any).data) && (responseData as any).data.length > 0) {
        const imageResult = (responseData as any).data[0];

        if (imageResult.b64_json) {
          imageUrl = `data:image/png;base64,${imageResult.b64_json}`;
          console.log('Generated inside card base64 image URL successfully');
        } else if (imageResult.url) {
          imageUrl = imageResult.url;
          console.log('Generated inside card image URL:', imageResult.url);
        } else {
          throw new Error('No image data received from GPT-Image-1');
        }
      } else {
        throw new Error('Invalid response format from GPT-Image-1 API');
      }

      console.log('Inside card generation completed successfully');

      // CRITICAL: PNG-ONLY WORKFLOW - Convert to PNG immediately and use PNG files throughout
      const { cardId } = req.body;
      
      if (cardId) {
        const pngStartTime = Date.now();
        console.log('[PNG_TIMING] Starting OPTIMIZED PNG conversion process...');
        
        try {
          // PERFORMANCE OPTIMIZATION: Run PNG operations in parallel
          const [unwatermarkedInsidePngUrl, insideImagePngUrl] = await Promise.all([
            // Step 1: Convert base64 to PNG file immediately (unwatermarked original)
            convertBase64ToPngFile(imageUrl, cardId, 'inside_unwatermarked'),
            // Step 2: Apply watermark directly to base64 and save as PNG (parallel processing)
            (async () => {
              const watermarkedBase64 = await applyWatermark(imageUrl, 0.25);
              return await convertBase64ToPngFile(watermarkedBase64, cardId, 'inside');
            })()
          ]);
          
          const totalPngDuration = Date.now() - pngStartTime;
          console.log(`[PNG_TIMING] OPTIMIZED PNG processing completed in ${totalPngDuration}ms (parallel processing)`);
          console.log(`[PNG_TIMING] Created unwatermarked: ${unwatermarkedInsidePngUrl}`);
          console.log(`[PNG_TIMING] Created watermarked: ${insideImagePngUrl}`);
        
          // Ensure response is sent immediately after PNG creation
          console.log('[PNG_ONLY] Sending response with PNG file URL:', insideImagePngUrl);
          
          // Check if response is still writable before sending
          if (!res.headersSent) {
            const responsePayload = { 
              imageUrl: insideImagePngUrl, // Return PNG file URL instead of Base64
              originalImageUrl: imageUrl, // Store original for secure access
              usage: (responseData as any).usage
            };
            
            res.json(responsePayload);
            const totalRequestDuration = Date.now() - requestStartTime;
            console.log(`[TIMING] Complete inside card generation finished in ${totalRequestDuration}ms`);
            console.log('[PNG_ONLY] Response sent successfully');
          } else {
            const totalRequestDuration = Date.now() - requestStartTime;
            console.log(`[TIMING] Headers already sent after ${totalRequestDuration}ms - connection may have timed out`);
          }
        } catch (pngError) {
          console.error('PNG processing error:', pngError);
          // Fallback to original response without PNG conversion
          const watermarkedImageUrl = await applyWatermark(imageUrl, 0.25);
          console.log('Watermark applied to inside card (PNG fallback)');
          
          res.json({ 
            imageUrl: watermarkedImageUrl,
            originalImageUrl: imageUrl,
            usage: (responseData as any).usage
          });
        }
      } else {
        // Fallback for requests without cardId (legacy support)
        const watermarkedImageUrl = await applyWatermark(imageUrl, 0.25);
        console.log('Watermark applied to inside card (legacy fallback)');
        
        res.json({ 
          imageUrl: watermarkedImageUrl,
          originalImageUrl: imageUrl,
          usage: (responseData as any).usage
        });
      }

    } catch (error: any) {
      console.error('Inside card generation error:', error);

      // Use enhanced error handler
      const { mapOpenAIError } = await import('../../shared/openaiErrorHandler');
      const mappedError = mapOpenAIError(error);
      
      console.log('🔍 MAPPED ERROR:', mappedError);

      res.status(mappedError.http).json({ 
        message: mappedError.userMessage, 
        isSafetyError: mappedError.kind === 'safety',
        errorType: mappedError.kind === 'safety' ? 'safety_filter' : mappedError.kind,
        errorKind: mappedError.kind,
        title: mappedError.title,
        techMessage: mappedError.techMessage,
        code: mappedError.code
      });
    }
  });


  app.post("/api/update-card-images", async (req, res) => {
    try {
      const { cardId, frontImageUrl, insideImageUrl, conversationData, status } = req.body;

      if (!cardId || !frontImageUrl) {
        return res.status(400).json({ message: "Card ID and front image URL are required" });
      }

      const updates: any = {
        frontImageUrl,
        status: status || 'completed'
      };

      if (insideImageUrl) {
        updates.insideImageUrl = insideImageUrl;
      }

      if (conversationData) {
        updates.conversationData = conversationData;
      }

      const updatedCard = await storage.updateCard(cardId, updates);

      if (!updatedCard) {
        return res.status(404).json({ message: "Card not found" });
      }

      console.log('Card updated successfully with images');
      res.json(updatedCard);
    } catch (error: any) {
      console.error('Update card error:', error);
      res.status(500).json({ message: "Failed to update card: " + error.message });
    }
  });


  app.post("/api/cards/:id/generate-background", async (req: any, res) => {
    try {
      const cardId = parseInt(req.params.id);
      if (isNaN(cardId)) {
        return res.status(400).json({ message: "Invalid card ID" });
      }

      // Resolve authenticated user from the OTP session (the only auth path)
      const userId = req.session?.otpUserId ?? null;

      const {
        userEmail,
        userName,
        generationType,
        imageDataArray,
        scenePrompt,
        style,
        includeText,
        cardText,
        userClothing,
        userArtStyle,
        insideText,
        artStyle,
        answers,
        uploadedPhotoIds
      } = req.body;

      if (!userEmail || !generationType || !answers) {
        return res.status(400).json({ message: "userEmail, generationType, and answers are required" });
      }

      // Only scene generation is currently supported via this endpoint.
      // Transform and text-only flows are dormant and will be re-enabled in a future release.
      if (generationType !== 'scene') {
        console.warn(`[BG_GEN] Rejected unsupported generationType: "${generationType}" for card ${cardId}`);
        return res.status(400).json({ message: "Only scene generation is currently supported." });
      }

      // Verify card exists
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      // Respond immediately so the user can leave
      res.json({ success: true, message: "Card is being created. You'll get an email when it's ready." });

      // Fire generation in the background
      const { generateCardInBackground } = await import('../background-generator');
      setImmediate(() => {
        generateCardInBackground({
          cardId,
          userId,
          userEmail,
          userName: userName || userEmail.split('@')[0],
          generationType,
          imageDataArray,
          scenePrompt,
          style,
          includeText,
          cardText,
          userClothing,
          userArtStyle,
          insideText,
          artStyle,
          answers,
          uploadedPhotoIds
        }).catch(err => {
          console.error(`[BG_GEN] Unhandled error in background generation for card ${cardId}:`, err);
        });
      });

    } catch (error: any) {
      console.error('Background generation endpoint error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to start background generation: " + error.message });
      }
    }
  });


  app.post("/api/assess-photo-quality", async (req, res) => {
    if (!openai) {
      return res.status(503).json({ error: "OpenAI API not configured" });
    }

    try {
      const { images } = req.body;
      
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: "Images array is required" });
      }

      console.log(`[PHOTO_QUALITY] Assessing quality for ${images.length} photos using GPT-4 Vision`);
      
      const assessments = await Promise.all(
        images.map(async (imageData: string, index: number) => {
          try {
            const response = await openai!.chat.completions.create({
              model: "gpt-4o",
              messages: [{
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Assess this photo's suitability for AI character generation. Rate each factor 1-10 and provide an overall quality score:

FACE QUALITY FACTORS:
- Face clarity/sharpness: Is the face in focus vs blurry?
- Face size in frame: Too small (poor), appropriate size (good), or too large (acceptable)
- Face angle: Profile view (poor 3-4), 3/4 view (good 6-7), frontal view (excellent 8-10)
- Lighting on face: Poor lighting/harsh shadows (low), even natural lighting (high)
- Eye visibility: Eyes clearly visible (high) vs sunglasses/hidden (reduces score)

TECHNICAL QUALITY:
- Overall image sharpness and focus
- Resolution and detail level
- Color balance and natural skin tones
- Noise/grain levels (low noise = better)

COMPOSITION FACTORS:
- Number of faces: Single person (best 8-10), multiple people (harder 5-7)
- Face obstructions: Clear face (high) vs hands/hair/objects covering (lower)
- Background complexity: Simple background (better) vs busy/distracting (lower)

ASSESSMENT REQUIREMENTS:
1. Provide overall quality score (1-10)
2. List 2-3 specific strengths or issues
3. Give recommendation: "Excellent for AI generation" / "Good with minor limitations" / "Fair - may have some issues" / "Poor - consider retaking photo"
4. If score is below 6, suggest specific improvements

Format: "Quality Score: X/10" followed by brief analysis.`
                  },
                  {
                    type: "image_url",
                    image_url: { url: imageData }
                  }
                ]
              }],
              max_tokens: 500,
              temperature: 0.3 // Lower temperature for more consistent assessments
            });

            const content = response.choices[0].message.content || "Could not assess photo quality";
            
            // Parse the response to extract structured data
            const scoreMatch = content.match(/Quality Score:\s*(\d+(?:\.\d+)?)/i);
            const score = scoreMatch ? parseFloat(scoreMatch[1]) : 5;
            
            // Determine rating and usability
            const rating = score >= 8 ? "Excellent" : 
                          score >= 6 ? "Good" : 
                          score >= 4 ? "Fair" : "Poor";
            
            const usableForGeneration = score >= 5;
            
            // Extract recommendation
            const recommendationMatch = content.match(/recommendation:\s*"([^"]+)"/i) ||
                                      content.match(/(Excellent for AI generation|Good with.*?limitations|Fair.*?issues|Poor.*?retaking)/i);
            const recommendation = recommendationMatch ? recommendationMatch[1] : 
                                 score >= 7 ? "Great for AI generation!" :
                                 score >= 5 ? "Usable with some limitations" :
                                 "Consider retaking photo for better results";

            console.log(`[PHOTO_QUALITY] Photo ${index + 1}: Score ${score}/10, Rating: ${rating}`);
            
            return {
              photoIndex: index + 1,
              qualityScore: score,
              rating,
              usableForGeneration,
              recommendation,
              detailedAnalysis: content,
              timestamp: new Date().toISOString()
            };
            
          } catch (error: any) {
            console.error(`[PHOTO_QUALITY] Error assessing photo ${index + 1}:`, error);
            return {
              photoIndex: index + 1,
              qualityScore: 5,
              rating: "Unknown",
              usableForGeneration: true,
              recommendation: "Unable to assess - proceeding with generation",
              detailedAnalysis: `Assessment failed: ${error.message}`,
              timestamp: new Date().toISOString()
            };
          }
        })
      );

      // Calculate overall session stats
      const avgScore = assessments.reduce((sum, a) => sum + a.qualityScore, 0) / assessments.length;
      const usableCount = assessments.filter(a => a.usableForGeneration).length;
      
      console.log(`[PHOTO_QUALITY] Assessment complete - Average score: ${avgScore.toFixed(1)}/10, ${usableCount}/${assessments.length} photos usable`);
      
      res.json({
        success: true,
        assessments,
        summary: {
          averageScore: Math.round(avgScore * 10) / 10,
          totalPhotos: assessments.length,
          usablePhotos: usableCount,
          recommendation: avgScore >= 7 ? "Photos are excellent for generation" :
                         avgScore >= 5 ? "Photos are suitable for generation" :
                         "Consider improving photo quality for better results"
        }
      });
      
    } catch (error: any) {
      console.error('[PHOTO_QUALITY] Assessment error:', error);
      res.status(500).json({ 
        error: "Failed to assess photo quality",
        message: error.message 
      });
    }
  });

}
