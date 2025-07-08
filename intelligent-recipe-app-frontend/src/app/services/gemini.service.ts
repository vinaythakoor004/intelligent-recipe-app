import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { catchError, map, Observable, of, throwError } from 'rxjs';
import { Recipe } from '../models/Recipe';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private geminiTextApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  private pixabayApiUrl = 'https://pixabay.com/api/';

  private geminiApiKey = environment.geminiApiKey; // Gemini API Key
  private pixabayApiKey = environment.pixabayApiKey; // Pixabay API Key

  constructor(private http: HttpClient) { }

  /**
   * Sends an image (Base64) to the Gemini API to check if it contains food.
   * @param base64ImageData The Base64 encoded string of the image data.
   * @returns An Observable that emits true if the image is food-related, false otherwise.
   */
  isFoodImage(base64ImageData: string): Observable<boolean> {
    if (!this.geminiApiKey || this.geminiApiKey === "YOUR_GEMINI_API_KEY_HERE_DEV" || this.geminiApiKey === "YOUR_GEMINI_API_KEY_HERE_PROD") {
      return throwError(() => new Error("Gemini API Key is not set. Cannot validate image content."));
    }

    const mimeTypeMatch = base64ImageData.match(/^data:(.*?);base64,/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';

    const promptText = `Does this image contain food ingredients? Respond with "true" if it does, and "false" if it does not. Do not include any other text.`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64ImageData
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1, // Keep temperature low for factual responses
        maxOutputTokens: 10, // Expect a very short response ("true" or "false")
      }
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post<any>(`${this.geminiTextApiUrl}?key=${this.geminiApiKey}`, payload, { headers }).pipe(
      map(response => {
        if (response.candidates && response.candidates.length > 0 &&
            response.candidates[0].content && response.candidates[0].content.parts &&
            response.candidates[0].content.parts.length > 0) {
          const text = response.candidates[0].content.parts[0].text.trim().toLowerCase();
          return text === 'true';
        }
        return false;
      }),
      catchError(error => {
        console.error('Error calling Gemini API for image validation:', error);
        let errorMessage = 'An error occurred during image validation.';
        if (error.error && error.error.error && error.error.error.message) {
          errorMessage = error.error.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        return throwError(() => new Error(`API Request Failed (Image Validation): ${errorMessage}`));
      })
    );
  }


  /**
   * Sends an image (Base64) to the Gemini API and requests recipe suggestions based on identified ingredients.
   * @param base64ImageData The Base64 encoded string of the image data.
   * @param cuisine Optional: The desired cuisine type (e.g., "Indian", "Italian").
   * @returns An Observable that emits an array of Recipe objects.
   */
  getRecipesFromImage(base64ImageData: string, cuisine: string = ''): Observable<Recipe[]> {
    if (!this.geminiApiKey || this.geminiApiKey === "YOUR_GEMINI_API_KEY_HERE_DEV" || this.geminiApiKey === "YOUR_GEMINI_API_KEY_HERE_PROD") {
      return throwError(() => new Error("Gemini API Key is not set. Please replace 'YOUR_GEMINI_API_KEY_HERE_DEV' in src/environments/environment.ts and 'YOUR_GEMINI_API_KEY_HERE_PROD' in environment.prod.ts."));
    }
    const mimeTypeMatch = base64ImageData.match(/^data:(.*?);base64,/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';

    let promptText = `Analyze the ingredients visible in this image. Based on these ingredients, suggest 2-3 distinct recipes.`;
    if (cuisine) {
      promptText += ` Focus on ${cuisine} cuisine.`;
    }
    promptText += ` For each recipe, provide the recipe name, a list of ingredients, and a list of step-by-step instructions.
Ensure the output is a JSON array of recipe objects. The JSON must strictly adhere to the following schema:
[
  {
    "recipeName": "Recipe 1 Name",
    "ingredients": ["Ingredient 1", "Ingredient 2"],
    "instructions": ["Step 1", "Step 2"]
  },
  {
    "recipeName": "Recipe 2 Name",
    "ingredients": ["Ingredient A", "Ingredient B"],
    "instructions": ["Step A", "Step B"]
  }
]
`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64ImageData
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              "recipeName": { "type": "STRING" },
              "ingredients": {
                "type": "ARRAY",
                "items": { "type": "STRING" }
              },
              "instructions": {
                "type": "ARRAY",
                "items": { "type": "STRING" }
              }
            },
            "propertyOrdering": ["recipeName", "ingredients", "instructions"]
          }
        }
      }
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post<any>(`${this.geminiTextApiUrl}?key=${this.geminiApiKey}`, payload, { headers }).pipe(
      map(response => {
        if (response.candidates && response.candidates.length > 0 &&
            response.candidates[0].content && response.candidates[0].content.parts &&
            response.candidates[0].content.parts.length > 0) {
          const jsonString = response.candidates[0].content.parts[0].text;
          try {
            const parsedRecipes = JSON.parse(jsonString) as Recipe[];
            if (Array.isArray(parsedRecipes) && parsedRecipes.every(r => typeof r === 'object' && r !== null && 'recipeName' in r)) {
                return parsedRecipes;
            } else {
                throw new Error("Parsed JSON is not in the expected Recipe[] format.");
            }
          } catch (e) {
            console.error('Failed to parse JSON response from Gemini API:', e);
            throw new Error('Invalid or malformed JSON response from the AI. Please try again or refine your prompt.');
          }
        }
        throw new Error('No valid content found in Gemini API response.');
      }),
      catchError((error) => {
        console.error('Error calling Gemini API (image analysis):', error);
        let errorMessage = 'An unknown error occurred while analyzing the image.';
        if (error.error && error.error.error && error.error.error.message) {
          errorMessage = error.error.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        return throwError(() => new Error(`API Request Failed (Image Analysis): ${errorMessage}`));
      })
    );
  }


  /**
   * (Previously generateRecipeSuggestions)
   * Sends a text prompt to the Gemini API and returns the generated content.
   * @param searchedWords The text prompt (ingredients/keywords) to send to the Gemini model.
   * @param cuisine Optional: The desired cuisine type (e.g., "Indian", "Italian").
   * @returns An Observable that emits an array of Recipe objects.
   */
  getRecipesFromText(searchedWords: string, cuisine: string = ''): Observable<Recipe[]> {
    if (!this.geminiApiKey || this.geminiApiKey === "YOUR_GEMINI_API_KEY_HERE_DEV" || this.geminiApiKey === "YOUR_GEMINI_API_KEY_HERE_PROD") {
      return throwError(() => new Error("Gemini API Key is not set. Please replace 'YOUR_GEMINI_API_KEY_HERE_DEV' in src/environments/environment.ts and 'YOUR_GEMINI_API_KEY_HERE_PROD' in environment.prod.ts."));
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    let prompt = `Suggest 2-3 distinct recipes using the following ingredients/keywords: "${searchedWords}".`;
    if (cuisine) {
      prompt += ` Focus on ${cuisine} cuisine.`;
    }
    prompt += ` For each recipe, provide the recipe name, a list of ingredients, and a list of step-by-step instructions.
Ensure the output is a JSON array of recipe objects. The JSON must strictly adhere to the following schema:
[
  {
    "recipeName": "Recipe 1 Name",
    "ingredients": ["Ingredient 1", "Ingredient 2"],
    "instructions": ["Step 1", "Step 2"]
  },
  {
    "recipeName": "Recipe 2 Name",
    "ingredients": ["Ingredient A", "Ingredient B"],
    "instructions": ["Step A", "Step B"]
  }
]
`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              "recipeName": { "type": "STRING" },
              "ingredients": {
                "type": "ARRAY",
                "items": { "type": "STRING" }
              },
              "instructions": {
                "type": "ARRAY",
                "items": { "type": "STRING" }
              }
            },
            "propertyOrdering": ["recipeName", "ingredients", "instructions"]
          }
        }
      }
    };

    return this.http.post<any>(`${this.geminiTextApiUrl}?key=${this.geminiApiKey}`, payload, { headers }).pipe(
      map(response => {
        if (response.candidates && response.candidates.length > 0 &&
            response.candidates[0].content && response.candidates[0].content.parts &&
            response.candidates[0].content.parts.length > 0) {
          const jsonString = response.candidates[0].content.parts[0].text;
          try {
            const parsedRecipes = JSON.parse(jsonString) as Recipe[];
            if (Array.isArray(parsedRecipes) && parsedRecipes.every(r => typeof r === 'object' && r !== null && 'recipeName' in r)) {
                return parsedRecipes;
            } else {
                throw new Error("Parsed JSON is not in the expected Recipe[] format.");
            }
          } catch (e) {
            console.error('Failed to parse JSON response from Gemini API:', e);
            throw new Error('Invalid or malformed JSON response from the AI. Please try again or refine your prompt.');
          }
        }
        throw new Error('No valid content found in Gemini API response.');
      }),
      catchError((error) => {
        console.error('Error calling Gemini API (text generation):', error);
        let errorMessage = 'An unknown error occurred while getting text recipes.';
        if (error.error && error.error.error && error.error.error.message) {
          errorMessage = error.error.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        return throwError(() => new Error(`API Request Failed (Text): ${errorMessage}`));
      })
    );
  }

  /**
   * Searches for an image on Pixabay using keywords.
   * @param keywords The search terms for the image (e.g., recipe name).
   * @returns An Observable that emits an array of image URLs, or a fallback array.
   */
  searchPixabayImage(keywords: string): Observable<string[]> {
    if (!this.pixabayApiKey || this.pixabayApiKey === "YOUR_PIXABAY_API_KEY_HERE") {
        console.warn("Pixabay API Key is not set. Using fallback image.");
        return of(['assets/images/default-food-image.jpg']);
    }

    const encodedKeywords = encodeURIComponent(keywords.replace(/[^a-zA-Z0-9 ]/g, ''));

    const url = `${this.pixabayApiUrl}?key=${this.pixabayApiKey}&q=${encodedKeywords}&image_type=photo&per_page=3&safesearch=true&orientation=horizontal&category=food`;

    return this.http.get<any>(url).pipe(
      map(response => {
        if (response && response.hits && response.hits.length > 0) {
          return response.hits.slice(0, 3).map((hit: any) => hit.webformatURL);
        } else {
          console.warn(`No Pixabay image found for "${keywords}". Using fallback.`);
          return ['assets/images/default-food-image.jpg'];
        }
      }),
      catchError(error => {
        console.error(`Error fetching image from Pixabay for "${keywords}":`, error);
        return of(['assets/images/default-food-image.jpg']);
      })
    );
  }
}
