const fs = require('fs');
const csv = require('csv-parser');

class QuestionManager {
    constructor() {
        this.questions = [];
        this.currentIndex = 0;
    }

    // Load questions from CSV file
    loadFromCSV(filePath) {
        return new Promise((resolve, reject) => {
            const questions = [];

            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    // Expected CSV format: question,optionA,optionB,optionC,optionD,correctAnswer
                    questions.push({
                        question: row.question,
                        options: {
                            A: row.optionA,
                            B: row.optionB,
                            C: row.optionC,
                            D: row.optionD
                        },
                        correctAnswer: row.correctAnswer.toUpperCase(),
                        id: questions.length + 1
                    });
                })
                .on('end', () => {
                    this.questions = questions;
                    this.currentIndex = 0;
                    console.log(`✅ Loaded ${questions.length} questions from CSV`);
                    resolve(questions.length);
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    // Add a single question manually
    addQuestion(questionData) {
        const question = {
            question: questionData.question,
            options: questionData.options,
            correctAnswer: questionData.correctAnswer.toUpperCase(),
            id: this.questions.length + 1
        };

        this.questions.push(question);
        return question;
    }

    // Get next question
    getNextQuestion() {
        if (this.currentIndex >= this.questions.length) {
            return null; // No more questions
        }

        const question = this.questions[this.currentIndex];
        this.currentIndex++;

        return {
            id: question.id,
            question: question.question,
            options: question.options,
            // Don't send correct answer to clients
            questionNumber: this.currentIndex,
            totalQuestions: this.questions.length
        };
    }

    // Check if answer is correct
    checkAnswer(questionId, answer) {
        const question = this.questions.find(q => q.id === questionId);
        if (!question) return false;

        return question.correctAnswer === answer.toUpperCase();
    }

    // Get correct answer for a question
    getCorrectAnswer(questionId) {
        const question = this.questions.find(q => q.id === questionId);
        return question ? question.correctAnswer : null;
    }

    // Reset to start
    reset() {
        this.currentIndex = 0;
    }

    // Get total question count
    getTotalQuestions() {
        return this.questions.length;
    }

    // Get remaining questions
    getRemainingQuestions() {
        return this.questions.length - this.currentIndex;
    }

    // Shuffle questions for randomization
    shuffle() {
        for (let i = this.questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.questions[i], this.questions[j]] = [this.questions[j], this.questions[i]];
        }
        // Update IDs after shuffle
        this.questions.forEach((q, index) => {
            q.id = index + 1;
        });
        this.currentIndex = 0;
    }
}

module.exports = QuestionManager;
