# Quiz Show (Kineshow)

This is a real-time Quiz system similar to Kahoot. It consists of a Host panel, a Display screen for projection, and a Player interface for participants.

## Prerequisites

- Node.js installed on the server machine.

## Installation

1. Navigate to the project folder.
2. Install dependencies:
   ```bash
   npm install
   ```

## How to Run

1. Start the server:
   ```bash
   npm start
   ```
2. The server runs on port 3000 by default.

## Usage

### 1. Host (Control Panel)
- Access: `http://localhost:3000/host.html`
- Use this panel to create new games, manage players, and advance questions.

### 2. Display (Projection Screen)
- Access: `http://localhost:3000/display.html`
- Open this on a separate screen or projector. Click anywhere on the page once to enable audio and full-screen mode.

### 3. Player (Participants)
- Access: `http://localhost:3000/player.html`
- Players enter the PIN shown on the Host/Display screen and their name to join.

## Customization

### Changing Questions
All quiz data is stored in `quiz.json` at the project root. You can modify this file to change questions, options, correct answers, and associated images.

### Changing Images
- All images must be placed in the `public/assets/` directory.
- Question Images: Update the `image` field in `quiz.json` for the specific question. Example: `"image": "/assets/my-image.jpg"`.
- Presenter Image: Replace or update `public/assets/presenter.png`. If you use a different filename, update the default path in `public/display.html`.

### Changing Audio
- All audio files are located in `public/audios/`.
- Replace `end.mp3`, `question.mp3`, or `suspense.mp3` with your own files maintaining the same filenames.
- Voice clips are found in `public/audios/falas/`.

## Network Settings and Local Environment

### Running on a Local Network
To allow other devices (like smartphones) to connect:
1. Find your computer's local IP address (e.g., 192.168.1.10).
2. Ensure the devices are on the same Wi-Fi network.
3. Players should access: `http://[YOUR_IP]:3000/player.html`.

### Using the QR Code
The QR Code generated in the Host lobby points to `/player.html`. For it to work on other devices, you must access the Host panel using your local IP instead of localhost (e.g., `http://192.168.1.10:3000/host.html`). This ensures the generated QR Code uses the reachable IP address.

## Game Persistence
The system saves the game state automatically in the `saves/` directory. If the server restarts, the Host can load a previous session via the "Carregar Jogo Salvo" button.
