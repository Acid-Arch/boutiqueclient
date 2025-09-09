Of course. Here are the step-by-step instructions in a markdown file format to update your application on the Hetzner server.
Markdown

# Deployment Guide: Updating Your Application 🚀

This guide will walk you through removing the old version of your application and deploying the new one from your GitHub repository.

**Server Details:**
* **IP Address:** `5.78.147.68`
* **User:** `admin`
* **Sudo Password:** `SecurePassword#123`
* **Repository:** `https://github.com/Acid-Arch/boutiqueclient.git`

---

## 1. Connect to Your Server

First, open your terminal and connect to your server using SSH. You'll be prompted to enter the password.

```bash
ssh admin@5.78.147.68

2. Stop and Remove the Old Application

We need to stop the currently running process using PM2 and then delete the old project folder.

    Stop the running app: Find your app's name or ID by running pm2 list. Then, stop it (replace boutiqueclient with your app's actual name if different).
    Bash

pm2 stop boutiqueclient
pm2 delete boutiqueclient

Navigate to the parent directory where your project is located (e.g., /home/admin).
Bash

cd ~

Remove the old directory: This command will permanently delete the folder and all its contents.
Bash

    sudo rm -rf boutiqueclient

    You'll need to enter your sudo password: SecurePassword#123

3. Deploy the New Version

Now, let's clone the new version of your application from GitHub and set it up.

    Clone the repository:
    Bash

git clone [https://github.com/Acid-Arch/boutiqueclient.git](https://github.com/Acid-Arch/boutiqueclient.git)

Navigate into the new project directory:
Bash

cd boutiqueclient

Install project dependencies: This reads your package.json file and installs the required libraries.
Bash

npm install

Build the application: If your project has a build step (common for React, Vue, etc.), run it now.
Bash

    npm run build

4. Run the New Application with PM2

Finally, start the new version of your app using PM2. This will keep it running in the background.

    Start the application: Replace your_start_script.js with the actual name of your app's entry file (e.g., app.js, server.js, or the start script from package.json).

    If using a start script from package.json:
    Bash

pm2 start npm --name "boutiqueclient" -- start

If starting a specific file:
Bash

pm2 start your_start_script.js --name "boutiqueclient"

Save the PM2 process list: This ensures your app will automatically restart if the server reboots.
Bash

    pm2 save

5. Verify the Deployment ✅

Check the status of your application to ensure it's running without errors.
Bash

pm2 status

You should see boutiqueclient with an online status. You can now visit your domain or IP address in a web browser to see the updated application.

