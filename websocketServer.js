const WebSocket = require("ws")
const http = require("http")

const server = http.createServer()
const wss = new WebSocket.Server({ server })

const clients = new Map()

wss.on("connection", (ws) => {
  console.log("Client connected")
  let userId = null
  let userRole = null

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message)
      console.log("Received:", data)

      switch (data.type) {
        case "register":
          userId = data.userId
          userRole = data.role || "user"
          clients.set(userId, { ws, role: userRole })
          console.log(`User registered: ${userId} (${userRole})`)

          // If this is the owner, send the list of connected users
          if (userRole === "owner") {
            const connectedUsers = Array.from(clients.keys()).filter((id) => id !== "owner")
            ws.send(JSON.stringify({ type: "users", users: connectedUsers }))
          } else {
            // Notify owner about new user
            const owner = clients.get("owner")
            if (owner) {
              owner.ws.send(JSON.stringify({ type: "userConnected", userId }))
            }
          }
          break

        case "removeUser":
          const userToRemove = clients.get(data.userId)
          if (userToRemove) {
            userToRemove.ws.close()
            clients.delete(data.userId)
            console.log(`User removed: ${data.userId}`)
          }
          break

        case "call":
        case "callAccepted":
        case "callRejected":
        case "ice-candidate":
        case "offer":
        case "answer":
        case "endCall":
          // Forward signaling messages to the target
          const target = clients.get(data.target)
          if (target) {
            target.ws.send(message.toString())
          } else {
            console.log(`Target ${data.target} not found`)
          }
          break

        default:
          console.log(`Unknown message type: ${data.type}`)
      }
    } catch (error) {
      console.error("Error processing message:", error)
    }
  })

  ws.on("close", () => {
    if (userId) {
      console.log(`Client disconnected: ${userId}`)
      clients.delete(userId)

      // Notify owner about user disconnection
      const owner = clients.get("owner")
      if (owner && userId !== "owner") {
        owner.ws.send(JSON.stringify({ type: "userDisconnected", userId }))
      }
    } else {
      console.log("Unregistered client disconnected")
    }
  })

  ws.on("error", (error) => {
    console.error("WebSocket error:", error)
    if (userId) {
      clients.delete(userId)
    }
  })
})

const PORT = process.env.PORT || 8080
server.listen(PORT, () => {
  console.log(`WebSocket server is running on port ${PORT}`)
})

// Handle server errors
server.on("error", (error) => {
  console.error("Server error:", error)
})

// Handle process termination
process.on("SIGINT", () => {
  wss.close(() => {
    console.log("WebSocket server closed")
    process.exit(0)
  })
})
