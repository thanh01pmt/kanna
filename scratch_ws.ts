const ws = new WebSocket("ws://localhost:3210")

ws.onopen = () => {
  console.log("Connected to Kanna WebSocket server!")
  // Send subscription for local-projects
  ws.send(JSON.stringify({
    v: 1,
    type: "subscribe",
    id: "sub-1",
    topic: { type: "local-projects" }
  }))
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log("Received message from server:")
  console.log(JSON.stringify(data, null, 2))
  ws.close()
  process.exit(0)
}

ws.onerror = (err) => {
  console.error("WS Error:", err)
}

setTimeout(() => {
  console.log("Timeout reached, closing.")
  ws.close()
  process.exit(1)
}, 5000)
