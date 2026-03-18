// OpenAI image API calls extracted from background-generator.ts (Phase 1, Step 2).
// Only contains: raw API calls, retry logic, and request construction.
// No orchestration, storage, DB, email, or Sharp logic lives here.

import FormData from 'form-data';

export async function callOpenAIImageEdit(params: {
  imageBuffers: { buffer: Buffer; mimeType: string }[];
  prompt: string;
  size?: string;
}): Promise<string> {
  const { imageBuffers, prompt, size = '1024x1024' } = params;

  const formData = new FormData();

  if (imageBuffers.length === 1) {
    formData.append('image', imageBuffers[0].buffer, {
      filename: `image.${imageBuffers[0].mimeType}`,
      contentType: `image/${imageBuffers[0].mimeType}`
    });
  } else {
    imageBuffers.forEach(({ buffer, mimeType }, index) => {
      formData.append('image[]', buffer, {
        filename: `image${index + 1}.${mimeType}`,
        contentType: `image/${mimeType}`
      });
    });
  }

  formData.append('prompt', prompt);
  formData.append('model', 'gpt-image-1.5');
  formData.append('n', '1');
  formData.append('size', size);
  formData.append('quality', 'high');
  formData.append('moderation', 'low');
  formData.append('background', 'auto');

  const fetch = (await import('node-fetch')).default;
  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      ...formData.getHeaders()
    },
    body: formData,
    // @ts-ignore - node-fetch supports timeout
    timeout: 300000
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData: any;
    try { errorData = JSON.parse(errorText); } catch { errorData = { error: { message: errorText } }; }
    throw new Error(`OpenAI API error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
  }

  const responseData = await response.json() as any;

  if (!responseData?.data?.[0]) {
    throw new Error('Invalid response format from OpenAI API');
  }

  const imageResult = responseData.data[0];
  if (imageResult.b64_json) {
    return `data:image/png;base64,${imageResult.b64_json}`;
  } else if (imageResult.url) {
    return imageResult.url;
  }
  throw new Error('No image data in OpenAI response');
}

function isSafetyViolation(message: string): boolean {
  return (
    message.includes('safety') ||
    message.includes('safety_violations') ||
    message.includes('content_policy') ||
    message.includes('rejected by the safety')
  );
}

export async function callOpenAIImageEditWithRetry(
  params: { imageBuffers: { buffer: Buffer; mimeType: string }[]; prompt: string; size?: string },
  cardId: number,
  maxAttempts = 3
): Promise<string> {
  let lastError: Error = new Error('Unknown error');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await callOpenAIImageEdit(params);
    } catch (err: any) {
      lastError = err;
      if (isSafetyViolation(err.message)) {
        if (attempt < maxAttempts) {
          console.warn(`[BG_GEN] Safety rejection on attempt ${attempt} for card ${cardId}, retrying in 3s...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          console.error(`[BG_GEN] All ${maxAttempts} attempts failed for card ${cardId} due to safety rejection`);
        }
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

export async function callOpenAITextGeneration(prompt: string, size = '1024x1024'): Promise<string> {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size,
      quality: 'high',
      output_format: 'b64_json'
    }),
    // @ts-ignore
    timeout: 300000
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData: any;
    try { errorData = JSON.parse(errorText); } catch { errorData = { error: { message: errorText } }; }
    throw new Error(`OpenAI text generation error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
  }

  const responseData = await response.json() as any;
  const imageResult = responseData?.data?.[0];
  if (!imageResult) throw new Error('No image data in OpenAI text generation response');
  if (imageResult.b64_json) return `data:image/png;base64,${imageResult.b64_json}`;
  if (imageResult.url) return imageResult.url;
  throw new Error('No image data in OpenAI text generation response');
}
