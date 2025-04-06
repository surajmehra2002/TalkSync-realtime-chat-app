const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");

const app = express();


// Connect to MongoDB
mongoose.connect("mongodb+srv://suryagroup:pUimq6aSocQYZkYw@clustermain0.tfx64.mongodb.net/LiveChat").then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// Define Message Schema & Model
const messageSchema = new mongoose.Schema({
    conversationId : {type: String,default:"suryagroup"}, // Unique ID for sender and receiver
    messages: [
        {
            senderId: String,
            receiverId: String,
            message: String,
            timestamp: { type: Date, default: Date.now },
            status: { type: String, default: "sent" } // 'sent' or 'read'
        }
    ]
    
});

const MessageModel = mongoose.model("Message", messageSchema);

app.use(cors());

// Store Connected Users
const connectedUsers = {}; // { userId: socketId }

const server = http.createServer(app); // Create an HTTP server

const io = new Server(server, {
    cors: { origin: "http://localhost:3000" }
});

app.io = io; // Attach io to app, so it's accessible inside routes


// Helper function to get all online user IDs
function getOnlineUsers() {
    return Object.keys(connectedUsers); // returns [userId1, userId2, ...]
}

io.on("connection", (socket) => {
    // console.log("User connected:", socket.id);
    // Handle User Authentication
    socket.on("register", (userData) => {
        const { userId, role } = userData;
        if (role !== "admin" && role !== "client") {
            console.log("Unauthorized User:", userData);
            socket.disconnect(); // Kick unauthorized users
            return;
        }
        console.log('connected are',connectedUsers)

        connectedUsers[userId] = socket.id; // Store socket ID
        console.log(`User ${userId} (${role}) connected with socket: ${socket.id}`);

        // Emit updated online users list
        io.emit("online-users", getOnlineUsers());
    });

    // Handle Incoming Messages
    socket.on("message", async (msg) => {
        try {
            const conversationId = 'suryagroup'
            console.log(msg)
            // mongodb database for saving new messsage
            let conversation = await MessageModel.findOne({ conversationId });

            if (!conversation) {
                // Create a new conversation if it doesn't exist
                conversation = new MessageModel({ conversationId, messages: [] });
            }

            // Add the new message to the array
            conversation.messages.push(msg);

            await conversation.save(); // Save updated document

            console.log(`Message stored in conversation ${conversationId}`);

            console.log(msg)
            console.log('connected',connectedUsers)
            const recipientSocket = connectedUsers[msg.receiverId];
            console.log('receipt',recipientSocket)
            if (recipientSocket) {
                io.to(recipientSocket).emit("message", msg);
                console.log(`Message sent to ${msg.receiverId}`);
            } else {
                console.log(`User ${msg.receiverId} is offline.`);
            }
        } catch (err) {
            console.error("Error saving message:", err);
        }
    });

    // Handle Disconnection
    socket.on("disconnect", () => {
        const userId = Object.keys(connectedUsers).find((id) => connectedUsers[id] === socket.id);
        if (userId) {
            delete connectedUsers[userId]; // Remove user from active list
        }
        // console.log("User disconnected:", socket.id);
        console.log(`User ${userId}  disconnected with socket: ${socket.id}`);

        // Emit updated online users list
        io.emit("online-users", getOnlineUsers());
    });
});





app.get('/',(req,res)=>{
    res.send('hello suraj')
})
app.get("/messages/:conversationId", async (req, res) => {
    try {
        const { conversationId} = req.params;
        console.log(conversationId)

        const conversation = await MessageModel.findOne({ conversationId });

        if (!conversation) {
            return res.json({ messages: [] }); // No conversation found
        }
console.log(conversation.messages)
        res.json({ messages: conversation.messages });
    } catch (err) {
        console.error("Error fetching messages:", err);
        res.status(500).send("Server error");
    }
});



// Start the server using `app.listen()`
const serverInstance = app.listen(5000, () => console.log("Server running on port 5000"));

// Attach Socket.io to the existing `serverInstance`
io.attach(serverInstance);
