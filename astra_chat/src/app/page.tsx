"use client"

import { useState } from "react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"


export default function Home() {
  const [message, setMessage] = useState("")
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>(null)

  const sendMessage = async () => {
    if (!message.trim()) return
    const userMessage = message
    setChatHistory((prev) => [...prev, { sender: "user", text: userMessage }])
    setMessage("")
    setLoading(true)

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      })
      const data = await res.json()
      setChatHistory((prev) => [...prev, { sender: "bot", text: data.result }])
      setDebugInfo(data.debug)
    } catch (err) {
      setChatHistory((prev) => [...prev, { sender: "bot", text: "Error fetching data." }])
      setDebugInfo(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100">
      <Card className="w-full max-w-2xl">
        <CardContent className="flex flex-col space-y-4 p-4">
          <div className="h-[400px] overflow-y-auto border rounded p-2 bg-white">
            {chatHistory.map((msg, idx) => (
              <div
                key={idx}
                className={`mb-2 ${msg.sender === "user" ? "text-right" : "text-left"}`}
              >
                <span className={`inline-block px-3 py-2 rounded-xl ${
                  msg.sender === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-black"
                }`}>
                  {msg.text}
                </span>
              </div>
            ))}
          </div>
          <div className="flex space-x-2">
            <Input
              placeholder="Ask about ClickHouse data..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={loading}>
              {loading ? "Sending..." : "Send"}
            </Button>
          </div>
          {debugInfo && (
            <div className="mt-4 p-2 bg-gray-200 rounded text-xs">
              <strong>Debug Info:</strong>
              <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
