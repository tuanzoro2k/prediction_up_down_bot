# Prediction Bot — Kiến trúc & Workflow (Mermaid)

Tài liệu tham khảo kiến trúc từ [CRE × GCP Prediction Market Demo](https://github.com/smartcontractkit/cre-gcp-prediction-market-demo), áp dụng cho dự án **prediction-bot** của bạn.

---

## 1. System Architecture (Kiến trúc hệ thống)

```mermaid
flowchart TB
    subgraph UserLayer["👤 User / Frontend"]
        User[User]
        Frontend[Vite + React<br/>Tailwind, TanStack Query]
        Frontend --> Auth[WalletConnect + JWT]
        Frontend --> Predictions[Predictions / Virtual Bets UI]
    end

    subgraph Backend["🟢 Backend — Express"]
        API[Express API]
        API --> AuthRoutes["/api/auth/nonce, verify"]
        API --> PredictRoutes["/api/predict?symbol=, /api/predictions"]
        API --> VirtualBetRoutes["/api/virtual-bet, /api/virtual-bets"]
        API --> PlaceBetRoute["/api/place-bet"]
        API --> UserRoutes["/api/user/profile"]
    end

    subgraph Agent["🤖 Polymarket Up/Down Agent"]
        PredictionAgent[PolymarketUpDownAgent]
        PredictionAgent --> getMarketData[getCurrentMarketData]
        PredictionAgent --> decideUpDown[decideUpDown]
        getMarketData --> TAAPI[TAAPI — indicators]
        decideUpDown --> OpenRouter[OpenRouter LLM<br/>structured JSON]
    end

    subgraph External["☁️ External Services"]
        Gamma[Polymarket Gamma API<br/>events, markets by slug]
        CLOB[Polymarket CLOB<br/>price, order book, place order]
        TAAPI
        OpenRouter
    end

    subgraph Data["🗄️ Data"]
        DB[(PostgreSQL<br/>Prisma)]
        DB --> UserModel[User]
        DB --> PredictionModel[Prediction]
        DB --> VirtualBetModel[VirtualBet]
    end

    subgraph Settlement["⏰ Settlement Cron"]
        Cron[node-cron mỗi 60s]
        Cron --> settlePending[settlePendingBets]
        settlePending --> FetchMarkets[fetchBtcUpDownMarkets]
        FetchMarkets --> Gamma
        settlePending --> UpdateBets[Update VirtualBet WON/LOST<br/>+ User balance]
    end

    User --> Frontend
    Frontend -->|REST + JWT| API
    API --> PredictionAgent
    API --> placePolymarketBet[placeBet.ts — ClobClient]
    PredictionAgent --> Gamma
    API --> DB
    settlePending --> DB
    placePolymarketBet --> CLOB
```

---

## 2. Flow: Predict (Lấy dự đoán UP/DOWN)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API as Express API
    participant Agent as PolymarketUpDownAgent
    participant TAAPI as TAAPI
    participant Gamma as Polymarket Gamma
    participant OpenRouter as OpenRouter LLM
    participant DB as PostgreSQL

    User->>Frontend: Chọn symbol (e.g. BTC)
    Frontend->>API: GET /api/predict?symbol=BTC (Bearer JWT)
    API->>Agent: agent.predict(symbol)

    Agent->>Agent: getCurrentMarketData(asset)
    Agent->>TAAPI: Indicators (5m, 4h)
    TAAPI-->>Agent: market_data (intraday, long_term)
    Agent->>Agent: buildUserContext(market_data)

    Agent->>Gamma: fetchBtcUpDownMarkets(slug)
    Note over Agent,Gamma: slug = btc-updown-15m-{roundedTimestamp}
    Gamma-->>Agent: market (question, outcomes, prices, clobTokenIds)

    Agent->>OpenRouter: decideUpDown(snapshot, context)
    Note over Agent,OpenRouter: systemPrompt + JSON schema (UP/DOWN/NO_BET)
    OpenRouter-->>Agent: { reasoning, decision }

    Agent-->>API: { market, marketData, result }
    API->>DB: prisma.prediction.create(...)
    API-->>Frontend: toHistoryResponse(row)
    Frontend-->>User: Hiển thị prediction + reasoning
```

---

## 3. Flow: Virtual Bet (Đặt cược ảo)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API as Express API
    participant DB as PostgreSQL

    User->>Frontend: Chọn prediction, direction (UP/DOWN), amount
    Frontend->>API: POST /api/virtual-bet (Bearer JWT)
    Note over Frontend,API: { predictionId, direction, amount }

    API->>DB: Kiểm tra user.balance >= amount
    API->>DB: prediction.findUnique(predictionId)
    API->>API: outcomePrice từ prediction.outcomePrices
    API->>API: potentialPayout = amount / outcomePrice

    API->>DB: $transaction
    Note over API,DB: virtualBet.create + user.update(balance decrement)
    API-->>Frontend: { id, direction, amount, potentialPayout, status: PENDING, balance }
    Frontend-->>User: Cập nhật UI + balance
```

---

## 4. Flow: Settlement (Cron giải quyết cược ảo)

```mermaid
sequenceDiagram
    participant Cron as node-cron
    participant Settlement as settlePendingBets
    participant DB as PostgreSQL
    participant Gamma as Polymarket Gamma

    Cron->>Settlement: Mỗi 60s
    Settlement->>DB: virtualBet.findMany({ status: PENDING })
    Settlement->>Settlement: Nhóm theo marketSlug

    loop Cho từng slug
        Settlement->>Gamma: fetchBtcUpDownMarkets({ slug })
        Gamma-->>Settlement: markets (outcomes, closed)
        alt market chưa closed
            Settlement->>Settlement: skip
        else market closed
            Settlement->>Settlement: winningDirection = UP nếu upOutcome.price > downOutcome.price else DOWN
            loop Cho từng bet
                Settlement->>Settlement: won = (bet.direction === winningDirection)
                Settlement->>Settlement: pnl = won ? potentialPayout - amount : -amount
                Settlement->>DB: virtualBet.update(WON/LOST, pnl, settledAt)
                alt won
                    Settlement->>DB: user.update(balance += potentialPayout)
                end
            end
        end
    end
```

---

## 5. Flow: Auth (Wallet Connect + JWT)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API as Express API
    participant DB as PostgreSQL

    User->>Frontend: Connect wallet (address)
    Frontend->>API: GET /api/auth/nonce?address=0x...
    API->>DB: user.findUnique hoặc user.create
    API-->>Frontend: { nonce }

    User->>Frontend: Sign message ("Sign to login... Nonce: ...")
    Frontend->>API: POST /api/auth/verify { address, signature }
    API->>API: ethers.verifyMessage(message, signature)
    API->>DB: user.update(nonce mới)
    API->>API: signToken({ userId, walletAddress })
    API-->>Frontend: { token, user }
    Frontend->>Frontend: localStorage.setItem('jwt_token', token)
```

---

## 6. Data Model (Prisma)

```mermaid
erDiagram
    User ||--o{ Prediction : "userId"
    User ||--o{ VirtualBet : "userId"
    Prediction ||--o{ VirtualBet : "predictionId"

    User {
        string id PK
        string walletAddress UK
        string nonce
        float balance
        datetime createdAt
        datetime updatedAt
    }

    Prediction {
        string id PK
        string userId FK
        string symbol
        datetime timestamp
        float currentPrice
        string marketSlug
        string question
        json outcomes
        json outcomePrices
        enum direction
        float sizeUsd
        float maxLossUsd
        float edgeProb
        string reasoning
        json clobTokenIds
    }

    VirtualBet {
        string id PK
        string userId FK
        string predictionId FK
        string marketSlug
        enum direction
        float amount
        float outcomePrice
        float potentialPayout
        enum status
        float pnl
        datetime settledAt
        datetime createdAt
    }
```

---

## 7. So sánh nhanh với CRE × GCP Demo

| Khía cạnh | CRE × GCP Demo | Prediction Bot (của bạn) |
|-----------|----------------|---------------------------|
| **Settlement** | On-chain (CRE detect event → Gemini → onReport) | Off-chain cron: Polymarket Gamma (market closed) → cập nhật DB |
| **AI** | Gemini (fact-check, search grounding) | OpenRouter LLM + TAAPI (technical indicators) |
| **Market data** | SimpleMarket.sol (Sepolia) | Polymarket Gamma + CLOB |
| **Cược** | USDC on-chain, claim thưởng on-chain | Virtual (balance trong DB) hoặc place order thật qua CLOB |
| **Frontend** | Next.js + Firestore | Vite + React + Express API + PostgreSQL |

---

*Dự án: prediction-bot — Tham khảo kiến trúc từ [cre-gcp-prediction-market-demo](https://github.com/smartcontractkit/cre-gcp-prediction-market-demo)*
