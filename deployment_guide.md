# 🚀 Hosting & Running Quiz Game Show Online

This guide provides a step-by-step walkthrough for hosting your Quiz Game Show on the internet so players can join from anywhere using their own devices.

## 📋 Prerequisites
1.  **A GitHub Account**: To store and sync your code.
2.  **A Hosting Account**: We recommend **Render.com** or **Railway.app** (both have free/cheap tiers and excellent WebSocket support).
3.  **Your Groq API Key**: For the AI features to work.

---

## 🛠️ Step 1: Prepare Your Code
Before hosting, ensure your code is ready for the cloud.

1.  **Initialize Git**: If you haven't already, run `git init` in your project folder.
2.  **Add a .gitignore**: Ensure you have a `.gitignore` file to prevent sensitive files from being uploaded.
    ```text
    node_modules/
    .env
    ```
3.  **Commit Your Changes**:
    ```bash
    git add .
    git commit -m "Prepare for deployment"
    ```
4.  **Push to GitHub**: Create a new repository on GitHub and follow the instructions to push your local code.

---

## 🌐 Step 2: Hosting on Render.com (Recommended)
Render is very easy to set up for Node.js applications.

1.  **Sign Up**: Go to [Render.com](https://render.com) and sign in with GitHub.
2.  **Create New Web Service**:
    - Click **New +** > **Web Service**.
    - Connect your GitHub repository.
3.  **Configure Settings**:
    - **Name**: `quiz-game-show` (or anything you like).
    - **Runtime**: `Node`.
    - **Build Command**: `npm install`.
    - **Start Command**: `npm start`.
4.  **Add Environment Variables**:
    - Click **Advanced** or go to the **Environment** tab.
    - Add `GROK_API_KEY` and paste your key.
5.  **Deploy**: Render will automatically start building and deploying your app. Once finished, you'll get a URL like `https://quiz-game-show.onrender.com`.

---

## ⚙️ Step 3: Important Considerations

### 1. WebSocket Support
Render supports WebSockets out of the box. However, if using a load balancer or multiple instances, ensure "Sticky Sessions" are enabled. For a single free instance, this is not a concern.

### 2. File Persistence
> [!IMPORTANT]
> By default, cloud platforms use "ephemeral storage." This means if you add questions via the Admin Panel, they will be **LOST** whenever the server restarts or you redeploy.
> 
> **Solution**: Always update your `junior-questions.json` and `waec-questions.json` files **locally**, commit them to Git, and push to GitHub. This ensures your academic data is permanent.

### 3. HTTPS
Your online URL will use `https`. Note that some older browsers might require you to explicitly allow "Insecure Content" if you were to mix HTTP and HTTPS, but since the whole app is served over HTTPS, this should be seamless.

---

## 🎮 Step 4: Accessing the Game
Once live, your URLs will be:
- **Main Admin**: `https://your-app-url.com/admin`
- **Question Display**: `https://your-app-url.com/display/question`
- **Player Pad**: `https://your-app-url.com/player/1` (Share this with your players!)

---

## 🏆 Troubleshooting
- **AI not working?** check the "Logs" section in your host dashboard to ensure `GROK_API_KEY` is correctly set.
- **Connection issues?** Ensure you are using the `https` version of your URL.
