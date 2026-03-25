// backend/index.js
const express = require('express');
const cors = require('cors');
const DisjointSet = require('./CircuitGraph');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize our DAA structure
const circuit = new DisjointSet();

// Route to add a wire (Union operation)
app.post('/api/wire', (req, res) => {
    const { nodeA, nodeB } = req.body;
    
    // Ensure nodes exist in our set
    circuit.makeSet(nodeA);
    circuit.makeSet(nodeB);

    // Union them
    circuit.union(nodeA, nodeB);
    
    res.json({ 
        message: `Wire connected ${nodeA} and ${nodeB}.`,
        rootA: circuit.find(nodeA),
        rootB: circuit.find(nodeB)
    });
});

// Route to check connection (Find operation)
app.get('/api/check-connection', (req, res) => {
    const { nodeA, nodeB } = req.query;
    const connected = circuit.areConnected(nodeA, nodeB);
    
    res.json({ 
        nodeA, nodeB, connected 
    });
});

// Add this route to backend/index.js

// Route to check for a short circuit
app.get('/api/check-short', (req, res) => {
    // For a standard breadboard, a short is when Power Positive connects to Power Negative
    // Let's check the top rail as an example
    const powerPos = 'node-power-top-pos';
    const powerNeg = 'node-power-top-neg';

    // 1. Fast check using DSU $O(1)$
    const rootPos = circuit.find(powerPos);
    const rootNeg = circuit.find(powerNeg);

    if (rootPos && rootNeg && rootPos === rootNeg) {
        // 2. If shorted, use BFS to find the exact path $O(V+E)$
        const shortPath = circuit.findShortCircuitPath(powerPos, powerNeg);
        
        return res.json({
            isShorted: true,
            message: "WARNING: Short Circuit Detected!",
            path: shortPath
        });
    }

    res.json({
        isShorted: false,
        message: "Circuit is safe."
    });
});

// Route to completely reset the board
app.post('/api/clear', (req, res) => {
    circuit.clear();
    res.json({ message: "Backend DSU and Graph memory wiped clean." });
});


// Route to add a Resistor
app.post('/api/resistor', (req, res) => {
    const { nodeA, nodeB, resistance } = req.body;
    
    // Default to a 1k Ohm resistor if no value is provided
    const rValue = resistance || 1000; 
    
    circuit.addResistor(nodeA, nodeB, rValue);
    
    res.json({ 
        message: `Placed a ${rValue}Ω resistor between ${nodeA} and ${nodeB}.`
    });
});


// Route to use the Multimeter (Dijkstra's Algorithm)
app.get('/api/multimeter', (req, res) => {
    const { nodeA, nodeB } = req.query;
    
    // Make sure nodes exist
    circuit.makeSet(nodeA);
    circuit.makeSet(nodeB);

    const resistance = circuit.calculateResistance(nodeA, nodeB);
    
    if (resistance === Infinity) {
        return res.json({ message: `No connection between ${nodeA} and ${nodeB}. (Open Circuit)` });
    }
    
    res.json({ 
        message: `Total Resistance between ${nodeA} and ${nodeB} is ${resistance}Ω.`,
        resistance: resistance
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Backend simulator running on http://localhost:${PORT}`);
});
