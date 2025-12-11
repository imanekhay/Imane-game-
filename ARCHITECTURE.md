# Memory Race - Software Architecture

## System Overview

Memory Race is a multiplayer memory game built with a microservices architecture. Players compete to memorize and reproduce sequences of symbols as quickly as possible.

---

## Architecture Diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────┐    ┌──────────────────────┐    ┌────────────────┐ │
│  │   Web Client         │    │   CLI Client         │    │ Mobile Client  │ │
│  │   (Svelte/Vite)      │    │   (TypeScript/Node)  │    │  (Planned)     │ │
│  │   Port: 5173         │    │   Terminal-based     │    │                │ │
│  ├──────────────────────┤    ├──────────────────────┤    └────────────────┘ │
│  │ - App.svelte         │    │ - CLI Interface      │                        │
│  │ - RoomSetup.svelte   │    │ - WebSocket Client   │                        │
│  │ - RoomView.svelte    │    │ - Readline Input     │                        │
│  │ - User/Ready Stores  │    │ - User Cache         │                        │
│  └──────────────────────┘    └──────────────────────┘                        │
│           │                            │                                      │
│           └────────────────────────────┘                                      │
└───────────────────────────┼──────────────────────────────────────────────────┘
                            │
                  HTTP/REST & WebSocket
                            │
┌───────────────────────────┼──────────────────────────────────────────────────┐
│                          API LAYER                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                            │                                                  │
│         ┌──────────────────┴────────────────────────┐                        │
│         │                                            │                        │
│         ▼                                            ▼                        │
│  ┌─────────────────┐    ┌────────────────────┐    ┌──────────────────────┐  │
│  │ User Service    │    │  Room Service      │    │  Game Service        │  │
│  │ Port: 3001      │    │  Port: 3002        │    │  Port: 3003          │  │
│  ├─────────────────┤    ├────────────────────┤    ├──────────────────────┤  │
│  │ Express + CORS  │    │ Express + WS       │    │  Express + CORS      │  │
│  ├─────────────────┤    ├────────────────────┤    ├──────────────────────┤  │
│  │ POST /users     │    │ POST /rooms        │    │ POST /create-round   │  │
│  │ POST /login     │    │ POST /join         │    │ POST /validate       │  │
│  │ GET  /users/:id │    │ POST /start        │    │                      │  │
│  │                 │    │ POST /ready        │    │ Round Generation     │  │
│  │ User Registry   │    │ WebSocket Server   │    │ Answer Validation    │  │
│  │ In-memory Map   │    │ Room State Mgmt    │    │ Winner Selection     │  │
│  └─────────────────┘    └────────────────────┘    └──────────────────────┘  │
│         │                         │                          ▲               │
│         │                         │                          │               │
│         │                         └──────────────────────────┘               │
│         │                         HTTP Request (Game Logic)                  │
└─────────┼──────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      In-Memory Data Stores                            │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │                                                                        │   │
│  │  User Service:                                                        │   │
│  │    • Map<userId, User>      - Users by ID                            │   │
│  │    • Map<username, User>    - Users by username (uniqueness)         │   │
│  │                                                                        │   │
│  │  Room Service:                                                        │   │
│  │    • Map<roomId, Room>      - Active rooms                           │   │
│  │    • WebSocket connections   - Player connections                     │   │
│  │    • Room state (status, players, rounds, answers)                   │   │
│  │                                                                        │   │
│  │  Game Service:                                                        │   │
│  │    • Stateless (no persistence)                                      │   │
│  │    • Symbol pool: ["★", "●", "♥", "■", "▲", "◆", "☀", "☂"]         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         SHARED TYPES LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  backend/shared/types.ts                                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ • SymbolChar - Game symbols type definition                            │ │
│  │ • Player - Player data structure                                       │ │
│  │ • ClientToServerMessage - WebSocket client messages                    │ │
│  │   - JoinRoomMessage, SubmitSequenceMessage, PlayerReadyMessage         │ │
│  │ • ServerToClientMessage - WebSocket server messages                    │ │
│  │   - RoomStateMessage, RoundStartMessage, EnterSequenceMessage,         │ │
│  │     RoundResultMessage, MatchEndMessage                                │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Descriptions

### **1. CLIENT LAYER**

#### **Web Client (Svelte/Vite)**

- **Technology**: Svelte framework with Vite build tool, TypeScript
- **Port**: 5173 (development)
- **Purpose**: Browser-based interactive UI for the memory game
- **Key Components**:
  - `App.svelte` - Main application container, handles login/registration and routing
  - `RoomSetup.svelte` - Room creation and joining interface
  - `RoomView.svelte` - Game room interface with sequence display and player interactions
  - `user.ts` store - Svelte store for user state management
  - `ready.ts` store - Tracks player ready states
  - API services (`roomService.ts`, `userService.ts`) - HTTP client wrappers
- **Features**:
  - Progressive Web App (PWA) with service worker and manifest
  - Real-time updates via WebSocket
  - Symbol sequence display and input collection
  - Score tracking and winner announcements

#### **CLI Client (Terminal-based)**

- **Technology**: TypeScript/Node.js with readline for terminal I/O
- **Purpose**: Command-line interface for headless/terminal gameplay
- **Key Features**:
  - Terminal-based UI using readline interface
  - WebSocket connection for real-time game updates
  - User authentication and room management
  - Symbol sequence input via keyboard
  - User name caching for display purposes
- **Use Cases**: Server environments, accessibility, developers

### **2. API LAYER (Microservices)**

#### **User Service (Port 3001)**

- **Technology**: Express.js, CORS-enabled, TypeScript
- **Purpose**: User authentication and profile management
- **Endpoints**:
  - `POST /users` - Register new user (generates UUID)
  - `POST /login` - Login existing user by username
  - `GET /users/:userId` - Retrieve user profile
- **Data Storage**:
  - In-memory maps (not persistent):
    - `Map<userId, User>` - Fast lookup by ID
    - `Map<username, User>` - Username uniqueness enforcement
- **Business Logic**:
  - UUID v4 generation for user IDs
  - Username uniqueness validation (409 conflict on duplicate)
  - No password authentication (simplified for game demo)

#### **Room Service (Port 3002)**

- **Technology**: Express.js + WebSocket Server (ws library), HTTP server
- **Purpose**: Real-time multiplayer room orchestration and game flow control
- **HTTP Endpoints**:
  - `POST /rooms` - Create new game room (auto-generates roomId or accepts custom)
  - `POST /rooms/:roomId/join` - Join existing room (max 2 players)
  - `POST /rooms/:roomId/start` - Start the match (requires 2 players)
  - `POST /rooms/:roomId/ready` - Mark player as ready for next round/restart
- **WebSocket Protocol**:
  - **Client → Server**:
    - `join_room` - Connect player to room
    - `submit_sequence` - Submit answer with timing
    - `player_ready` - Signal readiness
  - **Server → Client**:
    - `room_state` - Full room state broadcast (players, scores, status)
    - `round_start` - New round with sequence to memorize
    - `enter_sequence` - Prompt for player input
    - `round_result` - Round winner and correctness data
    - `match_end` - Final match winner
- **Room States**:
  - `waiting` - Awaiting players or ready signals
  - `in_round` - Active gameplay round
  - `finished` - Match complete
- **Game Flow Control**:
  - Broadcasts room state to all connected players
  - Coordinates round progression
  - Collects player answers and sends to Game Service for validation
  - Manages player readiness for round starts
  - Supports match restart after completion
- **Data**: `Map<roomId, Room>` with WebSocket connection tracking

#### **Game Service (Port 3003)**

- **Technology**: Express.js, CORS-enabled, stateless
- **Purpose**: Game logic engine (sequence generation and validation)
- **Endpoints**:
  - `POST /games/create-round` - Generate symbol sequence for round
    - Input: `{ round: number, difficulty?: number }`
    - Output: `{ round, sequence: SymbolChar[], displayMs: 6000 }`
    - Difficulty scaling: length = 3 + max(0, base-1), capped at 5
  - `POST /games/validate` - Validate player answers
    - Input: `{ round, sequence, answers: [{userId, sequence, timeMs}] }`
    - Output: `{ round, correctSequence, results: [], roundWinnerUserId }`
- **Game Logic**:
  - Random sequence generation from 8 symbols
  - Answer correctness validation (exact sequence match)
  - Winner determination by lowest time among correct answers
  - Display duration: 6000ms (6 seconds)
- **Design**: Stateless service (no data persistence), pure logic functions

---

### **3. DATA LAYER**

#### **In-Memory Storage**

- **Type**: Non-persistent, session-based
- **Rationale**: Simplified demo architecture, fast access, no database overhead
- **Data Structures**:
  - User Service: Two hash maps for dual-key access (ID and username)
  - Room Service: Single map with complex Room objects including player arrays, scores, game state
  - Game Service: No storage (stateless computation)
- **Limitations**:
  - Data lost on service restart
  - No horizontal scaling support (single instance only)
  - No data persistence or recovery

---

### **4. SHARED TYPES LAYER**

#### **backend/shared/types.ts**

- **Purpose**: Type safety and contract definition across services and clients
- **Key Types**:
  - `SymbolChar` - Union type of 8 game symbols
  - `Player` - User ID, display name, score
  - `ClientToServerMessage` - Union of all client-initiated WebSocket messages
  - `ServerToClientMessage` - Union of all server-broadcast WebSocket messages
- **Benefits**:
  - Type safety in TypeScript
  - Single source of truth for data contracts
  - Prevents message format mismatches
  - Enables IDE autocompletion

---

## Communication Patterns

### **1. HTTP/REST**

- **User Management**: Web/CLI Client ↔ User Service
- **Room Management**: Web/CLI Client ↔ Room Service (create, join, start, ready)
- **Game Logic**: Room Service → Game Service (round creation, validation)

### **2. WebSocket (Real-time)**

- **Connection**: Web/CLI Client ↔ Room Service
- **Purpose**: Low-latency bidirectional communication for gameplay
- **Events**: Room state updates, round start/end, player ready signals, sequence submission
- **Broadcast Pattern**: Room Service broadcasts to all players in a room

### **3. CORS**

- **Enabled on**: User Service, Game Service
- **Purpose**: Allow cross-origin requests from web client (different ports in dev)

---

## Data Flow Example (Complete Round)

```
1. Player Login
   Client → User Service (POST /users or /login)
   User Service → Client (returns {userId, username})

2. Room Creation/Joining
   Client → Room Service (POST /rooms or POST /rooms/:id/join)
   Room Service → Client (returns room data)

3. WebSocket Connection
   Client → Room Service (WebSocket connection)
   Client → Room Service (join_room message)
   Room Service → All Clients (room_state broadcast)

4. Ready & Start
   Client → Room Service (POST /ready or player_ready via WS)
   Host Client → Room Service (POST /start)
   Room Service → Game Service (POST /create-round)
   Game Service → Room Service (returns sequence)

5. Round Play
   Room Service → All Clients (round_start with sequence)
   [6 seconds display time]
   Room Service → All Clients (enter_sequence prompt)
   Clients → Room Service (submit_sequence with answers)

6. Round Validation
   Room Service → Game Service (POST /validate with all answers)
   Game Service → Room Service (returns correctness + winner)
   Room Service → All Clients (round_result broadcast)

7. Match End
   [After final round]
   Room Service → All Clients (match_end with final winner)
```

---

## Technology Stack Summary

| Layer                | Technology                        | Purpose                     |
| -------------------- | --------------------------------- | --------------------------- |
| **Frontend**         | Svelte, Vite, TypeScript          | Reactive UI framework       |
| **CLI**              | Node.js, TypeScript, readline, ws | Terminal interface          |
| **Backend Services** | Express.js, TypeScript            | HTTP API servers            |
| **Real-time**        | WebSocket (ws library)            | Bidirectional communication |
| **Build**            | TypeScript Compiler (tsc)         | Type-safe compilation       |
| **Data**             | JavaScript Maps                   | In-memory storage           |
| **Types**            | Shared TypeScript interfaces      | Contract definitions        |

---

## Deployment Considerations

### **Development**

- All services run on localhost with different ports
- User Service: 3001
- Room Service: 3002 (HTTP + WebSocket)
- Game Service: 3003
- Web Client: 5173

### **Production Recommendations**

- **Database**: Replace in-memory maps with Redis/PostgreSQL
- **Service Discovery**: Use API Gateway or service mesh
- **WebSocket Scaling**: Implement Redis pub/sub for multi-instance support
- **Authentication**: Add JWT tokens or session management
- **Environment Variables**: Use for service URLs (already partially implemented)
- **Container Orchestration**: Docker + Kubernetes for microservices deployment

---

## Key Architectural Decisions

1. **Microservices Architecture**: Separation of concerns (user, room, game logic)
2. **WebSocket for Real-time**: Low latency for competitive gameplay
3. **Stateless Game Service**: Pure logic service, scalable
4. **Stateful Room Service**: Maintains game state and WebSocket connections
5. **In-Memory Storage**: Simplified demo, acceptable for POC/development
6. **Shared Types**: TypeScript contracts prevent integration issues
7. **Multi-Client Support**: Web + CLI demonstrates platform flexibility

---
