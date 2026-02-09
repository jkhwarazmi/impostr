"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { ref, set, onValue, update, remove, child } from "firebase/database";
import { v4 as uuidv4 } from "uuid";
import { QRCodeSVG } from "qrcode.react";
import { Trash2, Eye, EyeOff, Crown, RefreshCw, MessageCircle, AlertTriangle, Fingerprint } from "lucide-react";

// --- TYPES ---
type Player = { id: string; name: string; isHost: boolean; word?: string; role?: "COMMON" | "IMPOSTER"; vote?: string };
type GameState = "LOBBY" | "PLAYING" | "PROMPT_REVEALED" | "VOTING" | "REVEALED";
type RoomData = {
  code: string;
  state: GameState;
  players: Record<string, Player>;
  settings: { imposters: number; type: "noun" | "question"; category: string };
  roundData?: { common: string; imposter: string; category: string };
};

// --- HELPER: Generate 4-letter Room Code ---
const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

export default function ImpostrApp() {
  // Local State
  const [playerId, setPlayerId] = useState<string>("");
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Game State
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [revealCard, setRevealCard] = useState(false);

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Generate or Retrieve Player ID
    let storedId = localStorage.getItem("impostr_pid");
    if (!storedId) {
      storedId = uuidv4();
      localStorage.setItem("impostr_pid", storedId);
    }
    setPlayerId(storedId);

    // 2. Check for "Join Link" in URL (QR Code support)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const joinCode = params.get("join");
      
      if (joinCode) {
        setRoomCode(joinCode.toUpperCase());
        // Clean URL without reloading
        window.history.replaceState({}, document.title, "/");
      }
    }
  }, []);

  // --- FIREBASE LISTENERS ---
  useEffect(() => {
    if (!joined || !roomCode) return;
    const roomRef = ref(db, `rooms/${roomCode}`);
    
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoomData(data);
        if (!data.players || !data.players[playerId]) {
          alert("You have been kicked from the room.");
          setJoined(false);
          setRoomData(null);
        }
      } else {
        setJoined(false); // Room deleted
      }
    });

    return () => unsubscribe();
  }, [joined, roomCode, playerId]);

  // --- ACTIONS ---

  const createRoom = async () => {
    if (!name) return alert("Enter a name!");
    const code = generateRoomCode();
    const newPlayer: Player = { id: playerId, name, isHost: true };
    
    await set(ref(db, `rooms/${code}`), {
      code,
      state: "LOBBY",
      // Default is "question"
      settings: { imposters: 1, type: "question", category: "" },
      players: { [playerId]: newPlayer }
    });
    setRoomCode(code);
    setJoined(true);
  };

  const joinRoom = async () => {
    if (!name || !roomCode) return alert("Enter name and code!");
    const codeUpper = roomCode.toUpperCase();
    const roomRef = ref(db, `rooms/${codeUpper}`);
    
    const newPlayer: Player = { id: playerId, name, isHost: false };
    await update(child(roomRef, `players/${playerId}`), newPlayer);
    setRoomCode(codeUpper);
    setJoined(true);
  };

  const kickPlayer = async (targetId: string) => {
    if (!roomData?.players[playerId].isHost) return;
    await remove(ref(db, `rooms/${roomCode}/players/${targetId}`));
  };

  const startGame = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: JSON.stringify({ 
          type: roomData?.settings?.type || "question", // Safe access fallback
          customPrompt: roomData?.settings?.category 
        })
      });
      const aiData = await res.json();

      const playerIds = Object.keys(roomData?.players || {});
      const imposterCount = Math.min(roomData?.settings?.imposters || 1, playerIds.length - 1);
      
      const shuffled = [...playerIds].sort(() => 0.5 - Math.random());
      const imposterIds = new Set(shuffled.slice(0, imposterCount));

      const updates: any = {};
      updates[`rooms/${roomCode}/state`] = "PLAYING";
      updates[`rooms/${roomCode}/roundData`] = aiData;

      playerIds.forEach(pid => {
        const isImposter = imposterIds.has(pid);
        updates[`rooms/${roomCode}/players/${pid}/role`] = isImposter ? "IMPOSTER" : "COMMON";
        updates[`rooms/${roomCode}/players/${pid}/word`] = isImposter ? aiData.imposter : aiData.common;
        updates[`rooms/${roomCode}/players/${pid}/vote`] = null;
      });

      await update(ref(db), updates);
    } catch (e) {
      alert("Error starting game: " + e);
    }
    setLoading(false);
  };

  const castVote = async (targetId: string) => {
    await update(ref(db, `rooms/${roomCode}/players/${playerId}`), { vote: targetId });
  };

  const revealPromptToAll = async () => {
    await update(ref(db, `rooms/${roomCode}`), { state: "PROMPT_REVEALED" });
  };

  const startVoting = async () => {
    await update(ref(db, `rooms/${roomCode}`), { state: "VOTING" });
  };

  const revealGame = async () => {
    await update(ref(db, `rooms/${roomCode}`), { state: "REVEALED" });
  };

  const resetGame = async () => {
    await update(ref(db, `rooms/${roomCode}`), { state: "LOBBY", roundData: null });
  };

  // --- RENDER HELPERS ---
  const amIHost = roomData?.players?.[playerId]?.isHost;
  const myPlayer = roomData?.players?.[playerId];
  const playersList = Object.values(roomData?.players || {});
  
  // FIX: Added '?.' to settings access to prevent crash on corrupted data
  const isQuestionMode = roomData?.settings?.type === "question";
  const termLabel = isQuestionMode ? "Question" : "Word";

  // --- VIEWS ---

  if (!joined) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-bold mb-8 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">IMPOSTR</h1>
        <div className="w-full max-w-sm bg-gray-800 p-6 rounded-xl shadow-xl space-y-4">
          <input 
            className="w-full bg-gray-700 p-3 rounded text-center text-lg outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Your Nickname"
            value={name} onChange={e => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={createRoom} className="bg-purple-600 hover:bg-purple-500 py-3 rounded font-bold transition">Host Game</button>
            <div className="flex flex-col gap-2">
               <input 
                className="bg-gray-700 p-3 rounded text-center outline-none uppercase"
                placeholder="Code"
                value={roomCode} onChange={e => setRoomCode(e.target.value)}
              />
              <button onClick={joinRoom} className="bg-gray-600 hover:bg-gray-500 py-2 rounded font-bold">Join</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LOBBY VIEW
  if (roomData?.state === "LOBBY") {
    // Safety check for incomplete room data
    if (!roomData.settings) return <div className="text-white p-10">Loading Room Settings...</div>;

    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 max-w-md mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Lobby</h2>
          <span className="bg-gray-700 px-3 py-1 rounded font-mono text-xl">{roomCode}</span>
        </div>
        
        <div className="bg-white p-4 rounded-xl w-fit mx-auto mb-6">
           {typeof window !== 'undefined' && <QRCodeSVG value={`${window.location.origin}?join=${roomCode}`} size={150} />}
        </div>

        <div className="space-y-2 mb-8">
          <h3 className="text-gray-400 uppercase text-xs font-bold tracking-widest">Players ({playersList.length})</h3>
          {playersList.map(p => (
            <div key={p.id} className="flex justify-between items-center bg-gray-800 p-3 rounded border border-gray-700">
              <div className="flex items-center gap-2">
                {p.isHost && <Crown size={16} className="text-yellow-400" />}
                <span>{p.name}</span>
              </div>
              {amIHost && !p.isHost && (
                <button onClick={() => kickPlayer(p.id)} className="text-red-400 hover:text-red-300"><Trash2 size={18}/></button>
              )}
            </div>
          ))}
        </div>

        {amIHost ? (
          <div className="bg-gray-800 p-4 rounded-xl space-y-4">
             <div className="flex gap-2">
                <button 
                  onClick={() => update(ref(db, `rooms/${roomCode}/settings`), { ...roomData.settings, type: "question" })}
                  className={`flex-1 py-2 rounded ${roomData.settings?.type === 'question' ? 'bg-purple-600' : 'bg-gray-700'}`}>
                  Questions
                </button>
                <button 
                  onClick={() => update(ref(db, `rooms/${roomCode}/settings`), { ...roomData.settings, type: "noun" })}
                  className={`flex-1 py-2 rounded ${roomData.settings?.type === 'noun' ? 'bg-purple-600' : 'bg-gray-700'}`}>
                  Nouns
                </button>
             </div>
             <input 
               className="w-full bg-gray-700 p-2 rounded" 
               placeholder="Custom Topic (Optional)" 
               onChange={(e) => update(ref(db, `rooms/${roomCode}/settings`), { ...roomData.settings, category: e.target.value })}
             />
             <div className="flex justify-between text-sm text-gray-400">
               <span>Imposters: {roomData.settings?.imposters || 1}</span>
               <input 
                 type="range" min="1" max="3" 
                 value={roomData.settings?.imposters || 1}
                 onChange={(e) => update(ref(db, `rooms/${roomCode}/settings`), { ...roomData.settings, imposters: parseInt(e.target.value) })}
                />
             </div>
             <button disabled={loading} onClick={startGame} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 py-3 rounded font-bold text-lg">
                {loading ? "Generating..." : "Start Game"}
             </button>
          </div>
        ) : (
          <div className="text-center text-gray-400 animate-pulse">Waiting for host to start...</div>
        )}
      </div>
    );
  }

  // PLAYING VIEW (Secret Phase)
  if (roomData?.state === "PLAYING") {
    if (!myPlayer?.role) return <div className="text-white p-10 text-center">Spectating...</div>;

    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
        <div className="text-center mb-8">
          <span className="text-xs font-bold tracking-widest text-purple-400 uppercase">{roomData.roundData?.category}</span>
          <h2 className="text-3xl font-bold mt-2">Your {termLabel}</h2>
        </div>
        
        <div 
          onClick={() => setRevealCard(!revealCard)}
          className="w-full max-w-sm aspect-[3/4] bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-700 rounded-2xl flex flex-col items-center justify-center p-6 cursor-pointer hover:border-purple-500 transition relative overflow-hidden text-center"
        >
          {revealCard ? (
            <>
              <p className="text-2xl font-bold leading-relaxed">{myPlayer.word}</p>
              <div className="absolute bottom-4 text-gray-500 flex items-center gap-2 text-sm"><EyeOff size={16}/> Tap to hide</div>
            </>
          ) : (
            <>
              <div className="text-6xl font-bold text-gray-700">?</div>
              <div className="absolute bottom-4 text-purple-400 flex items-center gap-2 text-sm"><Eye size={16}/> Tap to reveal</div>
            </>
          )}
        </div>

        {amIHost && (
          <button onClick={revealPromptToAll} className="mt-8 bg-yellow-600 hover:bg-yellow-500 px-8 py-3 rounded-full font-bold flex items-center gap-2">
            <MessageCircle size={20}/> Reveal {termLabel} to All
          </button>
        )}
      </div>
    );
  }

  // PROMPT REVEALED VIEW (Discussion Phase)
  if (roomData?.state === "PROMPT_REVEALED") {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-gray-400 uppercase text-sm font-bold tracking-widest mb-4">Discuss!</h2>
        <div className="bg-gray-800 border border-gray-600 p-8 rounded-2xl shadow-2xl mb-8 max-w-md w-full">
          <p className="text-purple-400 text-sm mb-2 uppercase font-bold">The Common {termLabel}</p>
          <h1 className="text-2xl md:text-3xl font-bold leading-tight">
            {roomData.roundData?.common}
          </h1>
        </div>
        
        <p className="text-gray-400 mb-8 max-w-sm">
          Discuss your answers. If someone's answer doesn't make sense for this {termLabel.toLowerCase()}, they might be the Imposter.
        </p>

        {amIHost ? (
          <button onClick={startVoting} className="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-full font-bold text-lg shadow-lg flex items-center gap-2">
            <Fingerprint size={24}/> Start Voting
          </button>
        ) : (
          <div className="animate-pulse text-yellow-400 font-bold">Waiting for host to open voting...</div>
        )}
      </div>
    );
  }

  // VOTING VIEW
  if (roomData?.state === "VOTING") {
     return (
       <div className="min-h-screen bg-gray-900 text-white p-6 max-w-md mx-auto">
         <h2 className="text-2xl font-bold mb-2 text-center">Who is the Imposter?</h2>
         <p className="text-center text-gray-400 mb-8">Tap a player to cast your suspicion.</p>
         
         <div className="grid grid-cols-2 gap-3 pb-24">
            {playersList.map(p => {
               const voteCount = playersList.filter(voter => voter.vote === p.id).length;
               return (
                 <button 
                  key={p.id}
                  disabled={!myPlayer?.role} 
                  onClick={() => castVote(p.id)}
                  className={`p-4 rounded-xl border relative transition-all active:scale-95 ${myPlayer?.vote === p.id ? 'border-red-500 bg-red-900/20' : 'border-gray-700 bg-gray-800'}`}
                 >
                   <div className="font-bold text-lg">{p.name}</div>
                   {voteCount > 0 && (
                     <div className="absolute top-2 right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                       {voteCount}
                     </div>
                   )}
                 </button>
               )
            })}
         </div>

         {amIHost && (
          <div className="fixed bottom-6 left-0 w-full px-6 flex justify-center">
            <button onClick={revealGame} className="w-full max-w-md bg-red-600 hover:bg-red-500 py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">
              <AlertTriangle /> Reveal Truth
            </button>
          </div>
        )}
       </div>
     )
  }

  // REVEALED VIEW (Final Results)
  if (roomData?.state === "REVEALED") {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 max-w-md mx-auto overflow-y-auto pb-32">
        <h1 className="text-3xl font-bold text-center mb-6">The Truth</h1>
        
        <div className="grid grid-cols-1 gap-4 mb-8">
           <div className="bg-gray-800 p-4 rounded-xl border border-gray-600">
              <div className="text-gray-400 text-xs uppercase">Common {termLabel}</div>
              <div className="text-lg font-bold text-green-400 leading-tight">{roomData.roundData?.common}</div>
           </div>
           <div className="bg-gray-800 p-4 rounded-xl border border-red-500/50">
              <div className="text-gray-400 text-xs uppercase">Imposter {termLabel}</div>
              <div className="text-lg font-bold text-red-400 leading-tight">{roomData.roundData?.imposter}</div>
           </div>
        </div>

        <div className="space-y-2">
           {playersList.map(p => (
             <div key={p.id} className={`flex items-center justify-between p-3 rounded ${p.role === 'IMPOSTER' ? 'bg-red-900/30 border border-red-500/50' : 'bg-gray-800'}`}>
                <div className="flex items-center gap-3">
                   <div className={`w-2 h-12 rounded-full ${p.role === 'IMPOSTER' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                   <div>
                     <div className="font-bold">{p.name}</div>
                     <div className="text-xs text-gray-400 truncate max-w-[150px]">{p.word}</div>
                   </div>
                </div>
                {p.role === 'IMPOSTER' && <span className="text-red-400 text-xs font-bold border border-red-400 px-2 py-1 rounded">IMPOSTER</span>}
             </div>
           ))}
        </div>

        {amIHost && (
          <div className="fixed bottom-6 left-0 w-full px-6 flex justify-center">
             <button onClick={resetGame} className="w-full max-w-md bg-purple-600 hover:bg-purple-500 py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">
                <RefreshCw /> Play Again
             </button>
          </div>
        )}
      </div>
    );
  }

  return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-purple-500"><RefreshCw className="animate-spin"/></div>;
}