import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const Breadboard = () => {
  const columns = 30;
  const range = (n) => Array.from({ length: n }, (_, i) => i + 1);
  const topRows = ['A', 'B', 'C', 'D', 'E'];
  const botRows = ['F', 'G', 'H', 'I', 'J'];

  const [firstClick, setFirstClick] = useState(null);
  const [elements, setElements] = useState([]);
  const [drawnElements, setDrawnElements] = useState([]);
  const [message, setMessage] = useState("System Ready.");
  const [tool, setTool] = useState('wire');

  const boardRef = useRef(null);
  const API_URL = 'http://localhost:8080/api';

  useEffect(() => {
    fetch(`${API_URL}/clear`, { method: 'POST' }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!boardRef.current) return;
    const boardRect = boardRef.current.getBoundingClientRect();

    const coords = elements.map(el => {
      const startEl = document.getElementById(el.start);
      const endEl = document.getElementById(el.end);
      if (!startEl || !endEl) return null;

      const sRect = startEl.getBoundingClientRect();
      const eRect = endEl.getBoundingClientRect();

      return {
        ...el,
        x1: sRect.left - boardRect.left + sRect.width / 2,
        y1: sRect.top - boardRect.top + sRect.height / 2,
        x2: eRect.left - boardRect.left + eRect.width / 2,
        y2: eRect.top - boardRect.top + eRect.height / 2,
      };
    }).filter(Boolean);

    setDrawnElements(coords);
  }, [elements]);

  const handleHoleClick = async (holeId, nodeId) => {
    if (!firstClick) {
      setFirstClick({ holeId, nodeId });
      setMessage(`Selected ${holeId}.`);
      return;
    }

    const nodeA = firstClick.nodeId;
    const nodeB = nodeId;
    const startHole = firstClick.holeId;

    if (startHole === holeId) {
      setFirstClick(null);
      setMessage("Canceled.");
      return;
    }

    setFirstClick(null);

    try {
      if (tool === 'wire' || tool === 'resistor') {
        const resVal = tool === 'resistor' ? 1000 : 0;
        const newEl = { type: tool, start: startHole, end: holeId, nodeA, nodeB, resistance: resVal };
        
        setElements(prev => [...prev, newEl]);

        const response = await fetch(`${API_URL}/${tool}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeA, nodeB, resistance: resVal })
        });
        const data = await response.json();
        setMessage(data.message);
      } 
      else if (tool === 'multimeter') {
        const response = await fetch(`${API_URL}/multimeter?nodeA=${nodeA}&nodeB=${nodeB}`);
        const data = await response.json();
        setMessage(data.message);
      }
    } catch (err) {
      setMessage("Backend Error.");
    }
  };

  const handleBoardClick = (e) => {
    if (e.target.classList.contains('hole')) {
      handleHoleClick(e.target.id, e.target.getAttribute('data-nodeid'));
    }
  };

  const checkShort = async () => {
    try {
      const response = await fetch(`${API_URL}/check-short`);
      const data = await response.json();
      setMessage(data.isShorted ? `DANGER: Short Circuit! Path: ${data.path.join(' -> ')}` : "Circuit is safe.");
    } catch (err) {
      setMessage("Backend Error.");
    }
  };

  const undo = async () => {
    if (elements.length === 0) return;
    const newElements = elements.slice(0, -1);
    setElements(newElements);

    try {
      const response = await fetch(`${API_URL}/rebuild`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions: newElements })
      });
      const data = await response.json();
      setMessage(`Undo: ${data.message}`);
    } catch (err) {
      setMessage("Backend Error.");
    }
  };

  const clear = async () => {
    setElements([]);
    setFirstClick(null);
    setMessage("Board cleared.");
    try { await fetch(`${API_URL}/clear`, { method: 'POST' }); } catch (err) {}
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <h2>Breadboard CAD</h2>
        <div className="sys-status">
          <p className="log-text">{message}</p>
        </div>

        <div className="toolbox">
          <h3>Tools</h3>
          <button className={`tool-btn ${tool === 'wire' ? 'active-wire' : ''}`} onClick={() => { setTool('wire'); setFirstClick(null); }}>🔌 Draw Wire</button>
          <button className={`tool-btn ${tool === 'resistor' ? 'active-res' : ''}`} onClick={() => { setTool('resistor'); setFirstClick(null); }}>⚡ Place Resistor</button>
          <button className={`tool-btn ${tool === 'multimeter' ? 'active-multi' : ''}`} onClick={() => { setTool('multimeter'); setFirstClick(null); }}>🎛️ Multimeter</button>
        </div>

        <div className="actions">
          <h3>Diagnostics</h3>
          <button className="action-btn primary" onClick={checkShort}>Run BFS Check</button>
          <button className="action-btn secondary" onClick={undo}>↩ Undo Last</button>
          <button className="action-btn danger" onClick={clear}>🗑️ Clear Board</button>
        </div>
      </div>

      <div className="workspace">
        <div className="board-wrapper" ref={boardRef}>
          <svg className="svg-overlay">
            {drawnElements.map((el, idx) => (
              el.type === 'wire' ? (
                <line key={idx} x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="#00d2ff" strokeWidth="4" strokeLinecap="round" />
              ) : (
                <g key={idx}>
                  <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="#1a2b3c" strokeWidth="6" strokeLinecap="round" />
                  <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="#ffea00" strokeWidth="4" strokeLinecap="round" strokeDasharray="6 4" />
                </g>
              )
            ))}
          </svg>

          <div className="breadboard blueprint" onClick={handleBoardClick}>
            <div className="power-rails">
              <div className="rail positive">
                {range(columns).map(c => <div id={`top-pos-${c}`} data-nodeid="node-power-top-pos" key={`top-pos-${c}`} className={`hole ${firstClick?.holeId === `top-pos-${c}` ? 'active' : ''}`}></div>)}
              </div>
              <div className="rail negative">
                {range(columns).map(c => <div id={`top-neg-${c}`} data-nodeid="node-power-top-neg" key={`top-neg-${c}`} className={`hole ${firstClick?.holeId === `top-neg-${c}` ? 'active' : ''}`}></div>)}
              </div>
            </div>
            <div className="divider"></div>
            
            <div className="terminal-strip">
              {topRows.map(r => (
                <div key={`row-${r}`} className="terminal-row">
                  {range(columns).map(c => <div id={`${r}${c}`} data-nodeid={`node-term-top-${c}`} key={`${r}${c}`} className={`hole ${firstClick?.holeId === `${r}${c}` ? 'active' : ''}`}></div>)}
                </div>
              ))}
            </div>
            <div className="ravine"></div>
            <div className="terminal-strip">
              {botRows.map(r => (
                <div key={`row-${r}`} className="terminal-row">
                  {range(columns).map(c => <div id={`${r}${c}`} data-nodeid={`node-term-bot-${c}`} key={`${r}${c}`} className={`hole ${firstClick?.holeId === `${r}${c}` ? 'active' : ''}`}></div>)}
                </div>
              ))}
            </div>

            <div className="divider"></div>
            <div className="power-rails">
              <div className="rail negative">
                {range(columns).map(c => <div id={`bot-neg-${c}`} data-nodeid="node-power-bot-neg" key={`bot-neg-${c}`} className={`hole ${firstClick?.holeId === `bot-neg-${c}` ? 'active' : ''}`}></div>)}
              </div>
              <div className="rail positive">
                {range(columns).map(c => <div id={`bot-pos-${c}`} data-nodeid="node-power-bot-pos" key={`bot-pos-${c}`} className={`hole ${firstClick?.holeId === `bot-pos-${c}` ? 'active' : ''}`}></div>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Breadboard;