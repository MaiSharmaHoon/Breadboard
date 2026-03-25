import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const Breadboard = () => {
  const columns = 30;
  const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

  const topRows = ['A', 'B', 'C', 'D', 'E'];
  const botRows = ['F', 'G', 'H', 'I', 'J'];

  // State variables
  const [firstClick, setFirstClick] = useState(null);
  const [wires, setWires] = useState([]);
  const [resistors, setResistors] = useState([]); 
  const [wireCoords, setWireCoords] = useState([]);
  const [serverMessage, setServerMessage] = useState("Waiting for connection...");
  const [shortWarning, setShortWarning] = useState(null);
  const [toolMode, setToolMode] = useState('wire'); // 'wire', 'resistor', or 'multimeter'
  
  const boardRef = useRef(null);

  useEffect(() => {
    if (!boardRef.current) return;
    const boardRect = boardRef.current.getBoundingClientRect();

    const coords = wires.map(wire => {
      const startEl = document.getElementById(wire.start);
      const endEl = document.getElementById(wire.end);
      
      if (startEl && endEl) {
        const startRect = startEl.getBoundingClientRect();
        const endRect = endEl.getBoundingClientRect();
        
        return {
          x1: startRect.left - boardRect.left + startRect.width / 2,
          y1: startRect.top - boardRect.top + startRect.height / 2,
          x2: endRect.left - boardRect.left + endRect.width / 2,
          y2: endRect.top - boardRect.top + endRect.height / 2,
        };
      }
      return null;
    }).filter(Boolean);

    setWireCoords(coords);
  }, [wires]); 

  const handleHoleClick = async (holeId, nodeId) => {
    if (!firstClick) {
      setFirstClick({ holeId, nodeId });
      setServerMessage(`Selected ${holeId}. Now click another hole.`);
      setShortWarning(null); 
      return;
    }

    const nodeA = firstClick.nodeId;
    const nodeB = nodeId;
    const startHole = firstClick.holeId;

    if (firstClick.holeId === holeId) {
      setFirstClick(null);
      setServerMessage("Canceled.");
      return;
    }

    setFirstClick(null);

    try {
      if (toolMode === 'wire') {
        setWires([...wires, { start: startHole, end: holeId }]);
        const response = await fetch('http://localhost:3000/api/wire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeA, nodeB })
        });
        const data = await response.json();
        setServerMessage(`Backend DSU: ${data.message}`);
      } 
      else if (toolMode === 'resistor') {
        setResistors([...resistors, { start: startHole, end: holeId, resistance: 1000 }]);
        const response = await fetch('http://localhost:3000/api/resistor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeA, nodeB, resistance: 1000 })
        });
        const data = await response.json();
        setServerMessage(`Backend Graph: ${data.message}`);
      }
      else if (toolMode === 'multimeter') {
        // DAA: Trigger Dijkstra's Algorithm API
        const response = await fetch(`http://localhost:3000/api/multimeter?nodeA=${nodeA}&nodeB=${nodeB}`);
        const data = await response.json();
        
        if (data.resistance === null || data.message.includes("Open Circuit")) {
            setShortWarning(`${data.message}`);
        } else {
            setShortWarning(`${data.message}`);
        }
        setServerMessage(`Probed ${startHole} and ${holeId}`);
      }
    } catch (err) {
      setServerMessage("Error: Backend offline.");
      console.error(err);
    }
  };

  const checkShortCircuit = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/check-short');
      const data = await response.json();
      
      if (data.isShorted) {
        setShortWarning(`DANGER: Short Circuit! BFS Path: ${data.path.join(' ➔ ')}`);
      } else {
        setShortWarning("Circuit is safe. No shorts detected.");
      }
    } catch (err) {
      console.error(err);
      setShortWarning("Error: Could not connect to backend.");
    }
  };

  const clearBoard = async () => {
    setWires([]);
    setResistors([]); 
    setWireCoords([]);
    setFirstClick(null);
    setShortWarning(null);
    setServerMessage("Board wiped clean.");

    try {
      await fetch('http://localhost:3000/api/clear', { method: 'POST' });
    } catch (err) {
      console.error("Failed to clear backend:", err);
    }
  };

  return (
    <div className="breadboard-container">
      <h2>Breadboard Simulator</h2>
      
      <div className = "cont">
        <div className= "smsg-board">
        <div className = "smsg">
          <p>{serverMessage}</p>
          {shortWarning && <p className={shortWarning.includes('DANGER') ? 'danger-text' : 'safe-text'} style={{color: shortWarning.includes('🎛️') ? '#ffaa00' : ''}}>{shortWarning}</p>}
        </div>


        <div className="board-wrapper" ref={boardRef}>
        
        <svg className="svg-overlay">
          {wireCoords.map((coord, idx) => (
            <line key={`wire-${idx}`} x1={coord.x1} y1={coord.y1} x2={coord.x2} y2={coord.y2} stroke="#00ffcc" strokeWidth="4" strokeLinecap="round" />
          ))}

          {resistors.map((resistor, idx) => {
            const startEl = document.getElementById(resistor.start);
            const endEl = document.getElementById(resistor.end);
            if (!startEl || !endEl || !boardRef.current) return null;
            
            const boardRect = boardRef.current.getBoundingClientRect();
            const startRect = startEl.getBoundingClientRect();
            const endRect = endEl.getBoundingClientRect();
            
            const x1 = startRect.left - boardRect.left + startRect.width / 2;
            const y1 = startRect.top - boardRect.top + startRect.height / 2;
            const x2 = endRect.left - boardRect.left + endRect.width / 2;
            const y2 = endRect.top - boardRect.top + endRect.height / 2;

            return (
              <g key={`resistor-${idx}`}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#333" strokeWidth="6" strokeLinecap="round" />
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffaa00" strokeWidth="4" strokeLinecap="round" strokeDasharray="4 4" />
              </g>
            );
          })}
        </svg>

        <div className="breadboard">
          <div className="power-rails">
            <div className="rail positive">
              {range(columns).map(col => (
                <div id={`top-pos-${col}`} key={`top-pos-${col}`} className={`hole ${firstClick?.holeId === `top-pos-${col}` ? 'active' : ''}`} onClick={() => handleHoleClick(`top-pos-${col}`, 'node-power-top-pos')}></div>
              ))}
            </div>
            <div className="rail negative">
              {range(columns).map(col => (
                <div id={`top-neg-${col}`} key={`top-neg-${col}`} className={`hole ${firstClick?.holeId === `top-neg-${col}` ? 'active' : ''}`} onClick={() => handleHoleClick(`top-neg-${col}`, 'node-power-top-neg')}></div>
              ))}
            </div>
          </div>

          <div className="divider"></div>

          <div className="terminal-strip">
            {topRows.map(row => (
              <div key={`row-${row}`} className="terminal-row">
                {range(columns).map(col => (
                  <div id={`${row}${col}`} key={`${row}${col}`} className={`hole ${firstClick?.holeId === `${row}${col}` ? 'active' : ''}`} onClick={() => handleHoleClick(`${row}${col}`, `node-term-top-${col}`)}></div>
                ))}
              </div>
            ))}
          </div>

          <div className="ravine"></div>

          <div className="terminal-strip">
            {botRows.map(row => (
              <div key={`row-${row}`} className="terminal-row">
                {range(columns).map(col => (
                  <div id={`${row}${col}`} key={`${row}${col}`} className={`hole ${firstClick?.holeId === `${row}${col}` ? 'active' : ''}`} onClick={() => handleHoleClick(`${row}${col}`, `node-term-bot-${col}`)}></div>
                ))}
              </div>
            ))}
          </div>

          <div className="divider"></div>

          <div className="power-rails">
            <div className="rail negative">
              {range(columns).map(col => (
                <div id={`bot-neg-${col}`} key={`bot-neg-${col}`} className={`hole ${firstClick?.holeId === `bot-neg-${col}` ? 'active' : ''}`} onClick={() => handleHoleClick(`bot-neg-${col}`, 'node-power-bot-neg')}></div>
              ))}
            </div>
            <div className="rail positive">
              {range(columns).map(col => (
                <div id={`bot-pos-${col}`} key={`bot-pos-${col}`} className={`hole ${firstClick?.holeId === `bot-pos-${col}` ? 'active' : ''}`} onClick={() => handleHoleClick(`bot-pos-${col}`, 'node-power-bot-pos')}></div>
              ))}
            </div>
          </div>
        </div>
      </div>
        </div>
        
        <div className="status-bar">
          
          {/* UPDATED TOOLBAR */}
          <div className="toolbar" style={{ margin: '15px 0', display: 'flex',flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
            <button 
              onClick={() => { setToolMode('wire'); setFirstClick(null); }}
              style={{ backgroundColor: toolMode === 'wire' ? '#444' : '#444', color: toolMode === 'wire' ? '#fff' : '#fff', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Draw Wire
            </button>
            <button 
              onClick={() => { setToolMode('resistor'); setFirstClick(null); }}
              style={{ backgroundColor: toolMode === 'resistor' ? '#ffaa00' : '#444', color: toolMode === 'resistor' ? '#000' : '#fff', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Place Resistor
            </button>
            <button 
              onClick={() => { setToolMode('multimeter'); setFirstClick(null); }}
              style={{ backgroundColor: toolMode === 'multimeter' ? '#ff44ff' : '#444', color: toolMode === 'multimeter' ? '#000' : '#fff', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Multimeter (Dijkstra)
            </button>
          </div>

          <div className="controls">
            <button onClick={checkShortCircuit} className="check-btn">Run BFS Short Check</button>
            <button onClick={clearBoard} className="check-btn" style={{marginLeft: '10px', backgroundColor: '#ff4444'}}>Clear Board</button>
          </div>

          <div className="wire-list">
            {wires.map((wire, idx) => (
              <span key={`w-badge-${idx}`} className="wire-badge" style={{borderColor: '#00ffcc'}}>{wire.start} ↔ {wire.end}</span>
            ))}
            {resistors.map((res, idx) => (
              <span key={`r-badge-${idx}`} className="wire-badge" style={{borderColor: '#ffaa00'}}>{res.start} 〰 {res.end} ({res.resistance}Ω)</span>
            ))}
          </div>
        </div>
      </div>
      
      
    </div>
  );
};

export default Breadboard;