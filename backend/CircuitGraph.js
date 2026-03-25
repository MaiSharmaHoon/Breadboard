class CircuitGraph {
    constructor() {
        
        this.parent = {};
        this.rank = {};
        
        this.adjList = {}; 
       
        this.components = [];
    }

    clear() {
        this.parent = {};
        this.rank = {};
        this.adjList = {};
        this.components = [];
    }

    makeSet(nodeId) {
        if (!this.parent[nodeId]) {
            this.parent[nodeId] = nodeId;
            this.rank[nodeId] = 0;
            this.adjList[nodeId] = []; 
        }
    }

    find(nodeId) {
        if (!this.parent[nodeId]) return null;
        if (this.parent[nodeId] !== nodeId) {
            this.parent[nodeId] = this.find(this.parent[nodeId]); 
        }
        return this.parent[nodeId];
    }

    union(node1, node2) {
        let root1 = this.find(node1);
        let root2 = this.find(node2);

        this.adjList[node1].push(node2);
        this.adjList[node2].push(node1);

        if (root1 === root2) return false;

        if (this.rank[root1] > this.rank[root2]) {
            this.parent[root2] = root1;
        } else if (this.rank[root1] < this.rank[root2]) {
            this.parent[root1] = root2;
        } else {
            this.parent[root2] = root1;
            this.rank[root1]++;
        }
        return true;
    }

    //bfs
    findShortCircuitPath(startNode, endNode) {
        if (!this.adjList[startNode] || !this.adjList[endNode]) return null;

        let queue = [ [startNode, [startNode]] ];
        let visited = new Set();
        visited.add(startNode);

        while (queue.length > 0) {
            let [curr, path] = queue.shift();
            if (curr === endNode) {
                return path; 
            }

            for (let neighbor of this.adjList[curr]) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push([neighbor, [...path, neighbor]]);
                }
            }
        }
        return null;
    }

    addResistor(nodeA, nodeB, resistance) {
        this.makeSet(nodeA);
        this.makeSet(nodeB);
        
        this.components.push({
            type: 'resistor',
            nodeA,
            nodeB,
            resistance
        });

    }

    // Dijkstra
    calculateResistance(nodeA, nodeB) {
        const rootA = this.find(nodeA);
        const rootB = this.find(nodeB);
        if (!rootA || !rootB) return Infinity; 
        if (rootA === rootB) return 0; 
        const adj = {};
        for (let node in this.parent) {
            const root = this.find(node);
            if (!adj[root]) adj[root] = [];
        }

        this.components.forEach(comp => {
            if (comp.type === 'resistor') {
                let rA = this.find(comp.nodeA);
                let rB = this.find(comp.nodeB);
                
                if (rA !== rB) {
                    adj[rA].push({ node: rB, weight: comp.resistance });
                    adj[rB].push({ node: rA, weight: comp.resistance });
                }
            }
        });

        const distances = {};
        const pq = []; // Priority Queue
        
        for (let node in adj) {
            distances[node] = Infinity;
        }
        distances[rootA] = 0;
        pq.push({ node: rootA, dist: 0 });
        while (pq.length > 0) {
            pq.sort((a, b) => a.dist - b.dist);
            const current = pq.shift();

            if (current.node === rootB) return distances[rootB];
            
            if (current.dist > distances[current.node]) continue;

            for (let neighbor of adj[current.node]) {
                let newDist = distances[current.node] + neighbor.weight;
                if (newDist < distances[neighbor.node]) {
                    distances[neighbor.node] = newDist;
                    pq.push({ node: neighbor.node, dist: newDist });
                }
            }
        }

        return Infinity; 
    }

}

module.exports = CircuitGraph;