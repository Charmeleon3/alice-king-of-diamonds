import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

export default function App() {
  const [roomCode, setRoomCode] = useState('');
  const [name, setName] = useState('');
  const [players, setPlayers] = useState([]);
  const [joined, setJoined] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [number, setNumber] = useState('');
  const [roundResult, setRoundResult] = useState(null);

  useEffect(() => {
    socket.on('room-created', () => setJoined(true));
    socket.on('players-update', setPlayers);
    socket.on('game-started', () => setGameStarted(true));
    socket.on('round-result', (data) => {
      setRoundResult(data);
      setNumber('');
    });
    socket.on('eliminated', () => alert('Sei stato eliminato.'));
    socket.on('error', (msg) => alert(msg));
  }, []);

  const createRoom = () => {
    socket.emit('create-room', { roomCode, name });
  };

  const joinRoom = () => {
    socket.emit('join-room', { roomCode, name });
    setJoined(true);
  };

  const startGame = () => {
    socket.emit('start-game', roomCode);
  };

  const submitNumber = () => {
    const num = parseFloat(number);
    if (isNaN(num) || num < 0 || num > 100) return alert('Scegli un numero da 0 a 100');
    socket.emit('submit-number', { roomCode, number: num });
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial' }}>
      <h1>Alice in Borderland: King of Diamonds</h1>
      {!joined ? (
        <>
          <input placeholder="Nome" value={name} onChange={e => setName(e.target.value)} />
          <input placeholder="Codice Stanza" value={roomCode} onChange={e => setRoomCode(e.target.value)} />
          <button onClick={createRoom}>Crea Stanza</button>
          <button onClick={joinRoom}>Entra in Stanza</button>
        </>
      ) : (
        <>
          <h2>Room: {roomCode}</h2>
          <h3>Giocatori:</h3>
          <ul>
            {players.map((p, i) => (
              <li key={i}>{p.name} — Vite: {p.lives}</li>
            ))}
          </ul>

          {!gameStarted ? (
            <button onClick={startGame}>Avvia Partita</button>
          ) : (
            <>
              <h3>Inserisci un numero da 0 a 100:</h3>
              <input value={number} onChange={e => setNumber(e.target.value)} type="number" />
              <button onClick={submitNumber}>Invia</button>
              {roundResult && (
                <div style={{ marginTop: '1rem' }}>
                  <p>Obiettivo: {roundResult.target.toFixed(2)}</p>
                  <p>Vincitore: {roundResult.winner}</p>
                  <p>Round: {roundResult.round}</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
