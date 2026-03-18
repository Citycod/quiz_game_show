const https = require('https');

const GROK_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

class GrokService {
    constructor() {
        this.apiKey = process.env.GROK_API_KEY || null;
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    /**
     * Generate quiz questions using Groq AI.
     * @param {string} schoolLevel - 'junior' or 'senior'
     * @param {number} round - Target round number
     * @param {number} count - Number of questions to generate
     * @returns {Promise<Array>} Array of question objects
     */
    async generateQuestions(schoolLevel, round, count = 5) {
        if (!this.apiKey) {
            throw new Error('Groq API key not configured. Set it in the Admin Panel → Settings tab or in .env.');
        }

        const curriculumPrompt = schoolLevel === 'junior'
            ? `You are a quiz question generator for Junior Secondary School students.
Generate questions based on the Lagos State curriculum for JSS1-JSS3.
Subjects: English Language, Social Studies, Civic Education, Agricultural Science, and other subjects
taught in Lagos State junior secondary schools.
The difficulty should be appropriate for students aged 10-14.`
            : `You are a quiz question generator for Senior Secondary School students preparing for WAEC exams.
Generate high-rigor, academic questions STRICTLY based on the WAEC (West African Examinations Council) Senior Secondary curriculum.
Questions MUST challenge students' understanding of complex concepts and use advanced academic terminology.
Topics should come from WAEC subjects: Biology, Chemistry, Physics, Mathematics, Economics, Government, Literature in English, and Geography.
The difficulty MUST match WAEC examination standard for SSS1-SSS3 students aged 15-18.`;

        const systemPrompt = `${curriculumPrompt}

IMPORTANT RULES:
- Each question MUST have exactly 4 options: A, B, C, D
- Exactly ONE option must be the correct answer
- Questions should be higher-order thinking (application, analysis, evaluation)
- Do NOT repeat common questions — be complex and academically rigorous
- Return ONLY a valid JSON array, no markdown, no explanation

Return a JSON object containing a "questions" array of ${count} objects in this EXACT format:
{
  "questions": [
    {
      "question": "The question text here?",
      "options": {
        "A": "First option",
        "B": "Second option",
        "C": "Third option",
        "D": "Fourth option"
      },
      "correctAnswer": "B"
    }
  ]
}`;

        const userPrompt = `Generate ${count} unique quiz questions for Round ${round}. Make them diverse across different subjects. Return ONLY the JSON object.`;

        const requestBody = JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.8,
            max_tokens: 4000
        });

        return new Promise((resolve, reject) => {
            const url = new URL(GROK_API_URL);

            const options = {
                hostname: url.hostname,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Length': Buffer.byteLength(requestBody)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        if (res.statusCode !== 200) {
                            const errorBody = JSON.parse(data);
                            reject(new Error(`Groq API Error (${res.statusCode}): ${errorBody.error?.message || data}`));
                            return;
                        }

                        const response = JSON.parse(data);
                        const content = response.choices[0].message.content;

                        // Extract JSON from the response (strip markdown code fences if present)
                        let jsonStr = content.trim();
                        if (jsonStr.startsWith('```')) {
                            jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
                        }

                        const parsedJson = JSON.parse(jsonStr);

                        // Find the array (it should be in parsedJson.questions, but we'll check)
                        let questionsArray = null;
                        if (Array.isArray(parsedJson)) {
                            questionsArray = parsedJson;
                        } else if (typeof parsedJson === 'object') {
                            for (const key in parsedJson) {
                                if (Array.isArray(parsedJson[key])) {
                                    questionsArray = parsedJson[key];
                                    break;
                                }
                            }
                        }

                        // Validate the questions
                        if (!questionsArray) {
                            throw new Error('AI did not return an array of questions');
                        }

                        const validated = questionsArray.map((q, i) => {
                            if (!q.question || !q.options || !q.correctAnswer) {
                                throw new Error(`Question ${i + 1} is missing required fields`);
                            }
                            if (!['A', 'B', 'C', 'D'].includes(q.correctAnswer.toUpperCase())) {
                                throw new Error(`Question ${i + 1} has invalid correctAnswer: ${q.correctAnswer}`);
                            }
                            return {
                                question: q.question,
                                options: {
                                    A: q.options.A,
                                    B: q.options.B,
                                    C: q.options.C,
                                    D: q.options.D
                                },
                                correctAnswer: q.correctAnswer.toUpperCase(),
                                round: parseInt(round)
                            };
                        });

                        resolve(validated);
                    } catch (parseError) {
                        reject(new Error(`Failed to parse Grok response: ${parseError.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Failed to connect to Grok API: ${error.message}`));
            });

            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('Grok API request timed out after 30 seconds'));
            });

            req.write(requestBody);
            req.end();
        });
    }

    /**
     * Generate a concise explanation for a correct answer.
     * @param {string} question - The question text
     * @param {string} correctAnswerText - The text of the correct option
     * @param {string} schoolLevel - 'junior' or 'senior'
     * @returns {Promise<string>} Concise explanation string
     */
    async generateExplanation(question, correctAnswerText, schoolLevel) {
        if (!this.apiKey) {
            return "Explanation unavailable (API key not configured).";
        }

        const audience = schoolLevel === 'junior' ? 'Junior Secondary School students' : 'Senior Secondary School students';
        
        const systemPrompt = `You are a Senior Secondary School academic tutor for WAEC students. 
Provide a strictly ONE-SENTENCE, sophisticated yet clear academic explanation for why a specific answer is correct. 
Target audience: ${audience}. 
Use precise academic terminology suitable for WAEC standards.
Return only the explanation text, no introductory phrases.`;

        const userPrompt = `Question: "${question}"
Correct Answer: "${correctAnswerText}"
Provide a simple 1-sentence explanation.`;

        const requestBody = JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.5,
            max_tokens: 150
        });

        return new Promise((resolve) => {
            const url = new URL(GROK_API_URL);
            const options = {
                hostname: url.hostname,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Length': Buffer.byteLength(requestBody)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode !== 200) {
                            resolve("Explanation logic error: " + res.statusCode);
                            return;
                        }
                        const response = JSON.parse(data);
                        resolve(response.choices[0].message.content.trim());
                    } catch (e) {
                        resolve("Explanation could not be summarized.");
                    }
                });
            });

            req.on('error', () => resolve("Explanation connection error."));
            req.setTimeout(5000, () => {
                req.destroy();
                resolve("Explanation timeout.");
            });
            req.write(requestBody);
            req.end();
        });
    }
}

module.exports = GrokService;
