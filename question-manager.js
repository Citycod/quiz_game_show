const fs = require('fs');
const csv = require('csv-parser');

class QuestionManager {
    constructor() {
        this.questions = {
            1: [],
            2: [],
            3: [],
            4: [],
            5: [] // Sudden Death
        };
        this.currentIndex = {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0
        };
    }

    // Load questions from CSV file for a specific round
    loadFromCSV(filePath, round = 1) {
        return new Promise((resolve, reject) => {
            const newQuestions = [];

            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    newQuestions.push({
                        question: row.question,
                        options: {
                            A: row.optionA,
                            B: row.optionB,
                            C: row.optionC,
                            D: row.optionD
                        },
                        correctAnswer: row.correctAnswer.toUpperCase(),
                        id: `r${round}-${this.questions[round].length + newQuestions.length + 1}`,
                        round: parseInt(round)
                    });
                })
                .on('end', () => {
                    this.questions[round] = [...this.questions[round], ...newQuestions];
                    console.log(`✅ Loaded ${newQuestions.length} questions for Round ${round} from CSV`);
                    resolve(newQuestions.length);
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    // Add a single question manually
    addQuestion(questionData, targetRound = null) {
        const round = targetRound || questionData.round || 1;
        const question = {
            question: questionData.question,
            options: questionData.options,
            correctAnswer: questionData.correctAnswer.toUpperCase(),
            id: `r${round}-${this.questions[round].length + 1}`,
            round: parseInt(round)
        };

        this.questions[round].push(question);
        return question;
    }

    // Get next question for a specific round
    getNextQuestion(round = 1) {
        const roundNum = parseInt(round);
        if (!this.questions[roundNum] || this.currentIndex[roundNum] >= this.questions[roundNum].length) {
            return null;
        }

        const question = this.questions[roundNum][this.currentIndex[roundNum]];
        this.currentIndex[roundNum]++;

        return {
            id: question.id,
            question: question.question,
            options: question.options,
            questionNumber: this.currentIndex[roundNum],
            totalQuestions: this.questions[roundNum].length,
            round: roundNum
        };
    }

    // Check if answer is correct
    checkAnswer(questionId, answer) {
        // Search across all rounds for the questionId
        let foundQuestion = null;
        for (const round in this.questions) {
            foundQuestion = this.questions[round].find(q => q.id === questionId);
            if (foundQuestion) break;
        }
        
        if (!foundQuestion) return false;
        return foundQuestion.correctAnswer === answer.toUpperCase();
    }

    // Get correct answer for a question
    getCorrectAnswer(questionId) {
        for (const round in this.questions) {
            const question = this.questions[round].find(q => q.id === questionId);
            if (question) return question.correctAnswer;
        }
        return null;
    }

    // Reset all or specific round
    reset(round = null) {
        if (round) {
            this.currentIndex[round] = 0;
        } else {
            Object.keys(this.currentIndex).forEach(r => {
                this.currentIndex[r] = 0;
            });
        }
    }

    // Clear all questions
    clearAll() {
        Object.keys(this.questions).forEach(r => {
            this.questions[r] = [];
            this.currentIndex[r] = 0;
        });
    }

    // Get total question count (all rounds)
    getTotalQuestions() {
        return Object.values(this.questions).reduce((acc, qList) => acc + qList.length, 0);
    }

    // Get count for specific round
    getRoundQuestionCount(round) {
        return this.questions[round] ? this.questions[round].length : 0;
    }

    // Shuffle questions for a specific round
    shuffle(round = null) {
        const roundsToShuffle = round ? [round] : Object.keys(this.questions);
        
        roundsToShuffle.forEach(r => {
            const qList = this.questions[r];
            for (let i = qList.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [qList[i], qList[j]] = [qList[j], qList[i]];
            }
            this.currentIndex[r] = 0;
        });
    }
}

module.exports = QuestionManager;
