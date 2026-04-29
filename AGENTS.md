# AGENTS.md

## Project
A web app that lets users record themselves humming or singing, 
then identifies the song using the ACRCloud API.

## Stack
- Frontend: plain HTML/CSS/JS (no framework)
- Backend: Node.js with Express
- Audio: Web Audio API / MediaRecorder for recording in browser
- Song ID: ACRCloud humming recognition API

## Commands
- npm install
- node server.js to start

## Notes
- Keep it simple, single page app
- API keys go in a .env file, never hardcoded