#include <iostream>
#include <string>
#include <unordered_map>
#include <vector>
#include <set>
#include <queue>
#include <limits>
#include <cmath>
#include "httplib.h"
#include "json.hpp"

using json = nlohmann::json;
using namespace httplib;

// Component Structure for Resistors
struct Component {
    std::string type;
    std::string nodeA;
    std::string nodeB;
    int resistance;
};

// DAA Graph Class
class CircuitGraph {
private:
    std::unordered_map<std::string, std::string> parent;
    std::unordered_map<std::string, int> rank;
    std::unordered_map<std::string, std::vector<std::string>> adjList;
    std::vector<Component> components;

    // --- Linear Algebra Solver (Gaussian Elimination) ---
    std::vector<double> solveLinearSystem(std::vector<std::vector<double>>& A, std::vector<double>& b) {
        int n = A.size();
        for (int i = 0; i < n; i++) {
            // Find pivot
            double maxEl = std::abs(A[i][i]);
            int maxRow = i;
            for (int k = i + 1; k < n; k++) {
                if (std::abs(A[k][i]) > maxEl) {
                    maxEl = std::abs(A[k][i]);
                    maxRow = k;
                }
            }
            std::swap(A[maxRow], A[i]);
            std::swap(b[maxRow], b[i]);

            // Singular matrix safety
            if (std::abs(A[i][i]) < 1e-12) continue;

            // Eliminate column
            for (int k = i + 1; k < n; k++) {
                double c = -A[k][i] / A[i][i];
                for (int j = i; j < n; j++) {
                    if (i == j) A[k][j] = 0;
                    else A[k][j] += c * A[i][j];
                }
                b[k] += c * b[i];
            }
        }

        // Back substitution
        std::vector<double> x(n, 0.0);
        for (int i = n - 1; i >= 0; i--) {
            if (std::abs(A[i][i]) < 1e-12) continue;
            x[i] = b[i] / A[i][i];
            for (int k = i - 1; k >= 0; k--) {
                b[k] -= A[k][i] * x[i];
            }
        }
        return x;
    }

public:
    void clear() {
        parent.clear();
        rank.clear();
        adjList.clear();
        components.clear();
    }

    void makeSet(const std::string& nodeId) {
        if (parent.find(nodeId) == parent.end()) {
            parent[nodeId] = nodeId;
            rank[nodeId] = 0;
            adjList[nodeId] = std::vector<std::string>();
        }
    }

    // Path Compression
    std::string find(std::string nodeId) {
        if (parent.find(nodeId) == parent.end()) return "";
        if (parent[nodeId] != nodeId) {
            parent[nodeId] = find(parent[nodeId]);
        }
        return parent[nodeId];
    }

    // Union by Rank
    bool unionNodes(const std::string& node1, const std::string& node2) {
        std::string root1 = find(node1);
        std::string root2 = find(node2);

        adjList[node1].push_back(node2);
        adjList[node2].push_back(node1);

        if (root1 == root2 || root1 == "" || root2 == "") return false;

        if (rank[root1] > rank[root2]) {
            parent[root2] = root1;
        } else if (rank[root1] < rank[root2]) {
            parent[root1] = root2;
        } else {
            parent[root2] = root1;
            rank[root1]++;
        }
        return true;
    }

    void addResistor(const std::string& nodeA, const std::string& nodeB, int resistance) {
        makeSet(nodeA);
        makeSet(nodeB);
        components.push_back({"resistor", nodeA, nodeB, resistance});
    }

    // BFS Short Circuit Detection
    std::vector<std::string> findShortCircuitPath(const std::string& startNode, const std::string& endNode) {
        if (adjList.find(startNode) == adjList.end() || adjList.find(endNode) == adjList.end()) {
            return {};
        }

        std::queue<std::pair<std::string, std::vector<std::string>>> q;
        std::set<std::string> visited;

        q.push({startNode, {startNode}});
        visited.insert(startNode);

        while (!q.empty()) {
            auto curr = q.front();
            q.pop();

            if (curr.first == endNode) return curr.second;

            for (const auto& neighbor : adjList[curr.first]) {
                if (visited.find(neighbor) == visited.end()) {
                    visited.insert(neighbor);
                    std::vector<std::string> newPath = curr.second;
                    newPath.push_back(neighbor);
                    q.push({neighbor, newPath});
                }
            }
        }
        return {};
    }

    // --- Physics-Based Resistance Calculator (Nodal Analysis) ---
    double calculateResistance(const std::string& nodeA, const std::string& nodeB) {
        std::string rootA = find(nodeA);
        std::string rootB = find(nodeB);

        if (rootA == "" || rootB == "") return -1.0; // Open Circuit
        if (rootA == rootB) return 0.0; // Direct short circuit via wires

        // 1. Build unweighted adjacency list just to find connected components
        std::unordered_map<std::string, std::vector<std::string>> graph;
        for (const auto& comp : components) {
            if (comp.type == "resistor") {
                std::string rA = find(comp.nodeA);
                std::string rB = find(comp.nodeB);
                if (rA != "" && rB != "" && rA != rB) {
                    graph[rA].push_back(rB);
                    graph[rB].push_back(rA);
                }
            }
        }

        // 2. BFS to isolate the specific circuit network we are testing
        std::unordered_map<std::string, int> node_idx;
        std::vector<std::string> nodes;
        std::queue<std::string> q;
        std::set<std::string> visited;

        q.push(rootA);
        visited.insert(rootA);

        while (!q.empty()) {
            std::string curr = q.front();
            q.pop();
            
            node_idx[curr] = nodes.size();
            nodes.push_back(curr);

            for (const std::string& neighbor : graph[curr]) {
                if (visited.find(neighbor) == visited.end()) {
                    visited.insert(neighbor);
                    q.push(neighbor);
                }
            }
        }

        // If rootB is not physically reachable from rootA, it's an open circuit
        if (visited.find(rootB) == visited.end()) return -1.0;

        // 3. Setup Nodal Analysis Matrix (Conductance Matrix G * Voltage V = Current I)
        int N = nodes.size();
        std::vector<std::vector<double>> G(N, std::vector<double>(N, 0.0));
        std::vector<double> I(N, 0.0);

        // Fill Conductance Matrix
        for (const auto& comp : components) {
            if (comp.type == "resistor") {
                std::string rA = find(comp.nodeA);
                std::string rB = find(comp.nodeB);
                
                if (node_idx.find(rA) != node_idx.end() && node_idx.find(rB) != node_idx.end() && rA != rB) {
                    int u = node_idx[rA];
                    int v = node_idx[rB];
                    double g = 1.0 / static_cast<double>(comp.resistance);
                    
                    G[u][u] += g;
                    G[v][v] += g;
                    G[u][v] -= g;
                    G[v][u] -= g;
                }
            }
        }

        // SPICE trick: Add tiny conductance to ground (1 pS) to prevent singular matrices
        for(int i = 0; i < N; i++) G[i][i] += 1e-12;

        int start_idx = node_idx[rootA];
        int end_idx = node_idx[rootB];

        // 4. Inject 1 Amp into Start Node, extract 1 Amp from End Node
        I[start_idx] = 1.0;
        I[end_idx] = -1.0;

        // 5. Hard Ground the End Node (V = 0) so the math has a reference point
        for (int j = 0; j < N; j++) {
            G[end_idx][j] = 0.0;
        }
        G[end_idx][end_idx] = 1.0;
        I[end_idx] = 0.0;

        // 6. Solve Linear System
        std::vector<double> V = solveLinearSystem(G, I);

        // R = V/I. Since I = 1 Amp, the total Resistance is exactly the Voltage at the Start Node!
        return V[start_idx];
    }
};

// CORS Helper
void set_cors(Response &res) {
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type");
}

int main() {
    Server svr;
    CircuitGraph circuit;

    // Handle Preflight OPTIONS requests for CORS
    svr.Options(R"(/api/.*)", [](const Request& req, Response& res) {
        set_cors(res);
    });

    svr.Post("/api/wire", [&circuit](const Request& req, Response& res) {
        set_cors(res);
        auto body = json::parse(req.body);
        circuit.makeSet(body["nodeA"]);
        circuit.makeSet(body["nodeB"]);
        circuit.unionNodes(body["nodeA"], body["nodeB"]);
        
        json response = {{"message", "Wire placed via C++ DSU."}};
        res.set_content(response.dump(), "application/json");
    });

    svr.Post("/api/resistor", [&circuit](const Request& req, Response& res) {
        set_cors(res);
        auto body = json::parse(req.body);
        int rValue = body.contains("resistance") ? (int)body["resistance"] : 1000;
        circuit.addResistor(body["nodeA"], body["nodeB"], rValue);
        
        json response = {{"message", "Resistor placed."}};
        res.set_content(response.dump(), "application/json");
    });

    svr.Get("/api/check-short", [&circuit](const Request& req, Response& res) {
        set_cors(res);
        std::string powerPos = "node-power-top-pos";
        std::string powerNeg = "node-power-top-neg";
        
        std::string rootPos = circuit.find(powerPos);
        std::string rootNeg = circuit.find(powerNeg);

        json response;
        if (rootPos != "" && rootNeg != "" && rootPos == rootNeg) {
            response["isShorted"] = true;
            response["path"] = circuit.findShortCircuitPath(powerPos, powerNeg);
        } else {
            response["isShorted"] = false;
        }
        res.set_content(response.dump(), "application/json");
    });

    svr.Get("/api/multimeter", [&circuit](const Request& req, Response& res) {
        set_cors(res);
        std::string nodeA = req.get_param_value("nodeA");
        std::string nodeB = req.get_param_value("nodeB");
        
        circuit.makeSet(nodeA);
        circuit.makeSet(nodeB);
        double resistance = circuit.calculateResistance(nodeA, nodeB);
        
        json response;
        if (resistance < 0) {
            response["message"] = "Open Circuit.";
            response["resistance"] = nullptr;
        } else {
            // Round to nearest integer to avoid float weirdness like 1499.99999 ohms
            int final_res = (int)std::round(resistance);
            response["message"] = "Resistance: " + std::to_string(final_res) + " Ohms";
            response["resistance"] = final_res;
        }
        res.set_content(response.dump(), "application/json");
    });

    svr.Post("/api/clear", [&circuit](const Request& req, Response& res) {
        set_cors(res);
        circuit.clear();
        res.set_content(R"({"message": "Cleared"})", "application/json");
    });

    svr.Post("/api/rebuild", [&circuit](const Request& req, Response& res) {
        set_cors(res);
        auto body = json::parse(req.body);
        circuit.clear();
        for (const auto& action : body["actions"]) {
            if (action["type"] == "wire") {
                circuit.makeSet(action["nodeA"]);
                circuit.makeSet(action["nodeB"]);
                circuit.unionNodes(action["nodeA"], action["nodeB"]);
            } else if (action["type"] == "resistor") {
                circuit.addResistor(action["nodeA"], action["nodeB"], action["resistance"]);
            }
        }
        res.set_content(R"({"message": "Rebuilt"})", "application/json");
    });

    std::cout << "Starting C++ Breadboard Engine on http://localhost:8080..." << std::endl;
    svr.listen("localhost", 8080);
    return 0;
}