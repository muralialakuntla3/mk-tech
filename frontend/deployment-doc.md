# Manual deployment guide
Deployment Process:
Server Setup
Clone the application code
Setup the Database 
Backend Deployment
Frontend Deployment
Project Details:
LMS application
Tech stack
Frontend: ReactJS 
Backend: Node JS - V20
Database: PostgreSql - v16
Connection Details
DB to BE Connection - .env in api folder
BE to FE Connection - .env in webapp folder

1. Server Setup
Choose the cloud - AWS/Azure
Launch the Linux server
OS: Ubuntu: 24.04
CPU: 02
RAM: 4GB
Storage: 15GB
Ports need to Open:
22 → server login
80 → to access frontend
443 → to access secure frontend
3000 → to access backend
5432 → to access PostgreSQL database
2. Clone the application code
Connect to the server
Update the Package manager - APT/YUM
Install GIT → if not exist
Clone the code into server
sudo apt update
git clone https://github.com/muralialakuntla3/lms-app.git


3. Setup the Database 
Install PostgreSQL-16 database into our server
Visit official website and follow the instruction
Link: https://www.postgresql.org/download/linux/ubuntu/
Check whether the PostgreSQL install or not
Login into Database and setup the password
Password: Admin123
Restart the database 
4. Backend Deployment
Configuring Database to Backend
Update database connection details in .env file
Enter into code folder → lms-app/api
Create/push the database Schema → before it install node & npm
Build the Backend
Setup the Runtime Environment
We need to install nodejs-20
Link: https://nodejs.org/en/download

Download the Backend Dependencies
Build the backend - it will generate the Artifacts
Run the Backend
Deploy artifacts - Run the backend using Artifacts
Check the backend with Pub-ip followed by Port 3000
5. Frontend Deployment
Configure the Backend to Frontend
Update backend working url in .env file
Build the Frontend
Setup the Runtime Environment
We need to install nodejs-20
Download the Frontend Dependencies
Build the frontend - it will generate the Artifacts
Host the Frontend Artifacts
Install the Web server - Nginx/Apache/caddy ….
Copy your Frontend Artifacts to Web Server Root/Document Directory
Restart the Webserver
Check the Frontend
Browse the Pub-ip followed by port 80
Try to Add some Courses in LMS
If Course added application deployment succeeded 
Otherwise you need to troubleshoot
