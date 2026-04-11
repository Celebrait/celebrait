import type { Express } from "express";
import { openai } from "../utils/shared";

export function registerAiRoutes(app: Express): void {
  app.post("/api/ai-brainstorm", async (req, res) => {
    try {
      if (!openai) {
        return res.status(503).json({ message: "OpenAI API is not configured" });
      }

      const { type, context, userInput, recipientName, celebration, conversationHistory, conversationStep, photoContext, userName, collectedInfo } = req.body;

      let systemPrompt = "";
      let messages: any[] = [];

      if (type === "scene") {
        // Use naturally inclusive language that works for both single and multiple people
        // Focus on scene elements (location, activity, clothing) rather than specific people
        
        systemPrompt = `You are a professional creative assistant helping someone create detailed scene descriptions for greeting cards for ${recipientName}'s ${celebration}. 

CRITICAL RULES:
1. NEVER address the user by name in your responses - use neutral language like "you" or avoid direct address
2. Use naturally inclusive language that works for both single and multiple people - focus on scene elements (location, activities, clothing, mood) rather than counting people
3. Ask about general scene elements: "What kind of activities would work well in this scene?" instead of "What would [name] be doing?"
4. Use inclusive terms: "What style of clothing would fit this setting?" instead of referring to specific people
5. NEVER make assumptions about relationships - even for anniversaries, birthday parties, or couple celebrations, avoid words like "couple", "pair", "duo", "romantic partners"
6. Focus on activities and scenes that could work for any number of people: "people enjoying", "someone relaxing", "activities in this setting"
7. NEVER provide suggestions in opening statements or unless explicitly requested
8. Only provide exactly 3 numbered options when user inputs "Get Suggestions" or "Get More Suggestions"  
9. Follow-up questions must seek MORE SPECIFIC details about previous answers
10. Keep opening messages simple and ask only one clear question

CONVERSATION FLOW:
1. INITIAL SCENE - User provides initial scene description (text input required)
2. SCENE SPECIFICS - Ask for more details (Give Me Ideas/Skip buttons)
3. ACTIVITY - What activities would work well in this scene (Give Me Ideas/Skip buttons)
4. CLOTHING - Clothing and appearance style (Give Me Ideas/Skip buttons)
5. SUMMARY - Complete scene summary (Sounds great let's go/I'd like to make a change buttons)

STEP-SPECIFIC INSTRUCTIONS:

INITIAL SCENE STEP:
- Ask simple question about WHERE scene takes place (NEVER provide suggestions)
- User MUST provide text input, no buttons available

SCENE SPECIFICS STEP:
- Ask for MORE SPECIFIC location details based on their answer
- Provide "Give Me Ideas" and "Skip This Question" buttons
- Only show 3 suggestions when user clicks "Give Me Ideas" button

ACTIVITY STEP:
- Ask simple question about what activities would work well in this scene
- Provide "Give Me Ideas" and "Skip This Question" buttons
- Only show 3 suggestions when user clicks "Give Me Ideas" button

CLOTHING STEP:
- Ask simple question about clothing and appearance style for this scene
- Provide "Give Me Ideas" and "Skip This Question" buttons
- Only show 3 suggestions when user clicks "Give Me Ideas" button
- ALWAYS remind that they can skip to let AI choose appropriate clothing

SUMMARY STEP:
- Summarize complete scene description for this ${celebration} celebration
- Tell user they can add more details if they like
- End with: "When you're ready to proceed, click 'Sounds great, let's go!' to continue to choosing text for the front of the card."
- CRITICAL: Only show "Sounds great, let's go!" and "I'd like to make a change" buttons in this step

CHANGE REQUEST:
- Ask specifically what they want to change
- Help modify that element
- Present updated summary with same buttons

Current step: ${conversationStep || 'initial_scene'}`;
        

        // Build context message based on current step and user input
        let contextMessage = `I'm creating a ${celebration} greeting card for ${recipientName}. Current step: ${conversationStep || 'initial_scene'}. User input: "${userInput || ''}"`;
        
        // Add photo context with detected face count
        if (photoContext) {
          contextMessage += ` Photo context: ${photoContext} detected in the uploaded photo - use this specific count when referring to people in the scene.`;
        }
        
        // Add collected information context
        if (collectedInfo) {
          const context = [];
          if (collectedInfo.initialScene) context.push(`Initial Scene: ${collectedInfo.initialScene}`);
          if (collectedInfo.sceneSpecifics) context.push(`Scene Specifics: ${collectedInfo.sceneSpecifics}`);
          if (collectedInfo.activity) context.push(`Activity: ${collectedInfo.activity}`);
          if (collectedInfo.clothing) context.push(`Clothing: ${collectedInfo.clothing}`);
          
          if (context.length > 0) {
            contextMessage += ` Previously collected: ${context.join(', ')}`;
          }
        }

        messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: contextMessage }
        ];
        
        // Add step-specific instructions based on current state
        if (userInput === "Give Me Ideas") {
          messages.push({
            role: "system", 
            content: `The user is requesting suggestions for the ${conversationStep} step. Provide exactly 3 numbered options relevant to this step. Format as: 1. First option, 2. Second option, 3. Third option. Focus on scene elements (activities, clothing, mood, setting details) using naturally inclusive language that works for any number of people. CRITICAL: Never use words like "couple", "pair", "duo", or "romantic partners" - use inclusive terms like "people", "someone", or focus on activities rather than relationships.`
          });
        } else if (!conversationHistory || conversationHistory.length === 0) {
          // This is an opening message - add extra emphasis to NOT provide suggestions
          messages.push({
            role: "system",
            content: `This is an opening message. Use this EXACT text as your response: "Greetings! ✨ I'm here to help you create an amazing scene for the front of ${recipientName || 'NAME'}'s ${celebration || 'CELEBRATION'} card.\n\nFor this first question, I'll need you to type your own creative input, but throughout the rest of our conversation you can either type your ideas or ask me for suggestions anytime.\n\nTo get us started, where would you like the scene to take place?"`
          });
        }
        
        if (conversationStep === 'summary') {
          messages.push({
            role: "system", 
            content: `Generate a complete scene summary using all collected information. Present the final scene description in a professional manner. CRITICAL: Do NOT include any numbered suggestions, options, or lists in your response. This is a final summary, not a suggestion step.

IMPORTANT FORMAT: You MUST wrap the complete scene description between [SCENE_START] and [SCENE_END] markers exactly like this example:

"Here's your complete scene:

[SCENE_START]
A cozy Christmas living room with a decorated tree, soft firelight, and warm holiday atmosphere. People gathered around opening presents with joyful expressions.
[SCENE_END]

Feel free to add any final touches! When you're ready to proceed, click 'Sounds great, let's go!' to continue to choosing text for the front of the card."

IMPORTANT: You are in the SUMMARY step - this means the frontend will show "Sounds great, let's go!" and "I'd like to make a change" buttons.`
          });
        }
        
        if (conversationStep === 'change_request') {
          messages.push({
            role: "system", 
            content: `The user wants to make a change to the scene. Process their change request and provide a complete updated scene description. 

IMPORTANT FORMAT: You MUST wrap the complete scene description between [SCENE_START] and [SCENE_END] markers exactly like this:

"Got it! Here's the updated scene:

[SCENE_START]
Your complete updated scene description goes here with all details.
[SCENE_END]

When you're ready to proceed, click 'Sounds great, let's go!' to continue to choosing text for the front of the card."

Make sure the scene description is complete and includes all previous elements plus the new changes.`
          });
        }
      } else if (type === "art_style") {
        systemPrompt = `You are a professional creative assistant helping users choose art styles for personalized greeting cards. You should:

1. Start by understanding the celebration and the feeling they want to convey
2. Ask one specific question at a time about their preferences
3. Only suggest specific art styles after gathering context about their preferences
4. Explain why certain styles work well for their celebration
5. Guide them toward the ideal style choice step-by-step
6. Keep the conversation professional but engaging

CONVERSATION FLOW:
- First interaction: Ask about the mood/feeling they want the card to convey
- Build on their responses with specific style suggestions
- Help them visualize exactly how different styles would look
- End with a perfect art style description they can use
- DO NOT provide suggestions in your first response - let the user provide their initial input first

Remember: You're helping them discover their perfect artistic vision through guided questions.`;
        
        messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: `I'm creating a ${celebration} greeting card for ${recipientName}. I need help choosing an art style. ${userInput || "I need help with the art style selection."}` }
        ];
      }

      // Add conversation history if provided
      if (conversationHistory && conversationHistory.length > 0) {
        messages = [
          { role: "system", content: systemPrompt },
          ...conversationHistory
        ];
      }

      console.log('AI Brainstorm request:', { type, recipientName, celebration, userInput, hasHistory: !!conversationHistory, photoContext });

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages,
        max_tokens: 400,
        temperature: 0.8 // Higher temperature for more creative suggestions
      });

      const aiResponse = response.choices[0].message.content;
      console.log('AI brainstorm response generated successfully');

      res.json({ 
        response: aiResponse,
        type,
        context: { recipientName, celebration, userInput }
      });

    } catch (error: any) {
      console.error('AI brainstorm error:', error);
      res.status(500).json({ message: "Failed to generate AI suggestions: " + error.message });
    }
  });


  app.post("/api/art-style-suggestions", async (req, res) => {
    if (!openai) {
      return res.status(503).json({ error: "OpenAI API not configured" });
    }

    try {
      const { sceneDescription, celebration, recipientName, photoContext, userName, previousSuggestions } = req.body;
      
      console.log('Art Style Suggestions request:', { sceneDescription, celebration, recipientName, photoContext, userName });
      
      // Since we're using naturally inclusive language, we don't need to detect multiple people
      // All prompts now work for any number of people
      const peopleReference = recipientName;

      // Build list of previously suggested items to avoid duplicates
      const avoidList = previousSuggestions && previousSuggestions.length > 0 
        ? previousSuggestions.map((s: any) => s.name).join(', ')
        : '';

      const systemPrompt = `You are an expert visual theme consultant specializing in greeting card design. Your job is to provide exactly 2 options: one traditional art style and one visual style reference.

CRITICAL RULES:
1. This card is FOR ${recipientName} - use naturally inclusive language that works for any number of people
2. When discussing the scene, focus on scene elements rather than counting people
3. Provide exactly 2 suggestions: one "art_style" and one "visual_style_reference"
4. Keep descriptions brief and concise (1-2 sentences max)
5. Consider the emotional impact and how relatable each option is for users
6. AVOID REPETITION: ${avoidList ? `Do NOT suggest any of these previously provided themes: ${avoidList}` : 'Provide completely fresh suggestions'}

DUAL APPROACH:
- First suggestion: Traditional art style (watercolor, oil painting, digital art, cartoon style, realistic portrait, etc.) - category: "art_style"
- Second suggestion: Visual Style Reference using descriptive terms that capture recognizable aesthetics without copyright infringement - category: "visual_style_reference"

VISUAL STYLE REFERENCE EXAMPLES (NO COPYRIGHT NAMES):
- Animation styles: "3D computer animated adventure style", "hand-drawn animated fairy tale style", "superhero comic book illustration style"
- Time periods: "1920s art deco elegance", "1950s vintage diner aesthetic", "1980s neon synthwave", "Victorian steampunk"
- Art movements: "impressionist garden painting style", "cubist portrait style", "pop art comic book style", "starry night swirling sky style"
- Genre aesthetics: "space opera sci-fi style", "romantic comedy warm tones", "magical fantasy realm style", "cozy coffee shop atmosphere"
- Cultural aesthetics: "Japanese anime illustration style", "Scandinavian minimalist design", "bohemian cottage core aesthetic"
- Photography styles: "golden hour portrait photography", "black and white dramatic lighting", "vintage polaroid snapshot style"

IMPORTANT: Use descriptive terms that capture the visual essence without mentioning specific copyrighted properties. Focus on searchable aesthetic terms that consistently produce similar visual results when users research them.

Scene: "${sceneDescription}"
Celebration: ${celebration}
Recipient: ${recipientName}
${photoContext ? `Photo context: ${photoContext}` : ''}

You must respond with valid JSON in this exact format (no markdown code blocks, just plain JSON):
{
  "message": "I've analyzed your scene and prepared 2 perfect options: one traditional Art Style and one Visual Style Reference with searchable aesthetic terms.",
  "suggestions": [
    {
      "name": "Traditional Art Style Name",
      "description": "Brief 1-2 sentence description",
      "whyItWorks": "Concise reason why this suits this ${celebration} scene",
      "famousExample": "Brief recognizable reference",
      "mood": "One word mood",
      "category": "art_style"
    },
    {
      "name": "Visual Style Reference Name (e.g., 3D Computer Animated Adventure, Impressionist Garden Painting, 1920s Art Deco Elegance)",
      "description": "Brief 1-2 sentence description of the visual style aesthetic",
      "whyItWorks": "Concise reason why this suits this ${celebration} scene",
      "famousExample": "Descriptive aesthetic term that users can Google for consistent visual examples", 
      "mood": "One word mood",
      "category": "visual_style_reference"
    }
  ]
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Please analyze this scene and provide art style suggestions in the required JSON format." }
        ],
        max_tokens: 1500,
        temperature: 0.7
      });

      const response = completion.choices[0].message.content;
      console.log('Art style suggestions response generated successfully');
      
      try {
        // Clean up the response by removing markdown code blocks if present
        let cleanResponse = response || '';
        if (response && response.includes('```json')) {
          cleanResponse = response.replace(/```json\s*/, '').replace(/```\s*$/, '');
        } else if (response && response.includes('```')) {
          cleanResponse = response.replace(/```\s*/, '').replace(/```\s*$/, '');
        }
        
        const parsedResponse = JSON.parse(cleanResponse);
        res.json(parsedResponse);
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        console.error('Raw response:', response);
        res.status(500).json({ error: "Failed to parse AI response" });
      }
    } catch (error) {
      console.error('Art style suggestions error:', error);
      res.status(500).json({ error: "Failed to generate style suggestions" });
    }
  });


  app.post("/api/art-style-chat", async (req, res) => {
    if (!openai) {
      return res.status(503).json({ error: "OpenAI API not configured" });
    }

    try {
      const { 
        userMessage, 
        sceneDescription, 
        celebration, 
        recipientName, 
        photoContext, 
        userName, 
        isExpertMode, 
        conversationHistory 
      } = req.body;
      
      console.log('Art Style Chat request:', { userMessage, sceneDescription, celebration, recipientName, isExpertMode });
      
      const systemPrompt = `You are an expert visual theme consultant having a conversation with ${userName} about choosing the perfect visual theme for their ${celebration} card for ${recipientName}.

CRITICAL RULES:
1. This card is FOR ${recipientName} - use naturally inclusive language that works for scenes with any number of people
2. When discussing the scene, focus on scene elements (activities, clothing, mood, setting) rather than counting people
3. Focus on how visual themes will enhance the overall scene and celebration
4. Emphasize FAMOUS THEMES from well-known references that users can easily research and understand

Scene context: "${sceneDescription}"
${photoContext ? `Photo context: ${photoContext}` : ''}
Expert mode: ${isExpertMode ? 'User prefers direct input but may still want suggestions' : 'User prefers guided suggestions'}

VISUAL STYLE REFERENCE CATEGORIES TO CONSIDER:
- Animation styles: "3D computer animated adventure style", "hand-drawn animated fairy tale style", "superhero comic book illustration style"
- Art movements: "impressionist garden painting style", "cubist portrait style", "pop art comic book style", "starry night swirling sky style"
- Time periods: "1920s art deco elegance", "1950s vintage diner aesthetic", "1980s neon synthwave", "Victorian steampunk"
- Genre aesthetics: "space opera sci-fi style", "romantic comedy warm tones", "magical fantasy realm style", "cozy coffee shop atmosphere"
- Cultural aesthetics: "Japanese anime illustration style", "Scandinavian minimalist design", "bohemian cottage core aesthetic"
- Photography styles: "golden hour portrait photography", "black and white dramatic lighting", "vintage polaroid snapshot style"

Your role:
1. Be warm, helpful, and educational
2. Answer questions about visual style references with descriptive aesthetic terms
3. When users ask for specific themes (Disney, soccer, vintage, etc.), ALWAYS provide exactly 2 structured suggestions in JSON format
4. Provide suggestions when asked (focus on searchable aesthetic terms without copyright issues)
5. Help users understand why certain visual styles work better for this ${celebration} celebration
6. If user seems unsure, offer to provide structured suggestions

CRITICAL: Always provide EXACTLY 2 suggestions when the user asks for style ideas - one art_style and one visual_style_reference.

If providing suggestions, respond with valid JSON in this exact format (no markdown code blocks, just plain JSON):
{
  "message": "Your conversational response about the scene and celebration",
  "suggestions": [
    {
      "name": "Traditional Art Style Name",
      "description": "Clear description of the art technique",
      "whyItWorks": "Why it suits this ${celebration} scene",
      "famousExample": "Brief recognizable reference",
      "mood": "One word mood",
      "category": "art_style"
    },
    {
      "name": "Visual Style Reference Name (e.g., 3D Computer Animated Adventure, Impressionist Garden Painting)",
      "description": "Clear description of the visual style aesthetic",
      "whyItWorks": "Why it suits this ${celebration} scene",
      "famousExample": "Descriptive aesthetic term that users can Google for consistent visual examples",
      "mood": "One word mood",
      "category": "visual_style_reference"
    }
  ]
}

If just having a conversation (no suggestions), respond with valid JSON:
{
  "message": "Your conversational response about the scene and celebration"
}`;

      const messages = [
        { role: "system", content: systemPrompt },
        ...conversationHistory.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        })),
        { role: "user", content: userMessage },
        { role: "system", content: `Based on the user's message, if they are asking for specific themes, ideas, or suggestions (like Disney, soccer, vintage, modern, etc.), you MUST respond with the JSON format including exactly 2 suggestions. If they're just asking questions or having a conversation, respond with just the message field in JSON format.` }
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 1500,
        temperature: 0.7
      });

      const response = completion.choices[0].message.content;
      console.log('Art style chat response generated successfully');
      
      try {
        // Clean up the response by removing markdown code blocks if present
        let cleanResponse = response || '';
        if (response && response.includes('```json')) {
          cleanResponse = response.replace(/```json\s*/, '').replace(/```\s*$/, '');
        } else if (response && response.includes('```')) {
          cleanResponse = response.replace(/```\s*/, '').replace(/```\s*$/, '');
        }
        
        const parsedResponse = JSON.parse(cleanResponse);
        res.json(parsedResponse);
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        console.error('Raw response:', response);
        // If not JSON, treat as plain text response
        res.json({ message: response || 'Unable to generate response' });
      }
    } catch (error) {
      console.error('Art style chat error:', error);
      res.status(500).json({ error: "Failed to generate chat response" });
    }
  });

}
