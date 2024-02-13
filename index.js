const http = require("http")
const Socket = require("websocket").server
const server = http.createServer(() => {
})

server.listen(3000, () => {

})

const webSocket = new Socket({httpServer: server})

const users = []
const rooms = []

const createChatRoom = (roomName, username, connection) => {
    const room = findRoom(roomName)
    if (room) {
        console.log(rooms)
        return
    }
    console.log(rooms)

    rooms.push({roomName: roomName, owner: username, members: [{username: username, connection: connection}]})
}


const removeChatRoom = (roomName) => {
    const index = rooms.findIndex(object => object.roomName === roomName);
    if (index !== -1) {
        rooms.splice(index, 1)
    }
}
const joinChatRoom = (roomName, username, connection) => {
    const room = findRoom(roomName)
    if (!room) {
        return;
    }
    const user = room.members.find( it => it.username === username)
    if (user){
        console.log("user exists")
        return;
    }
    room.members.push({username: username, connection: connection})
    console.log(rooms)
}

const leaveChatRoom = (roomName, username) => {
    const room = findRoom(roomName)
    if (room) {
        const userIndex = room.members.findIndex(object => object.username === username);
        room.members.splice(userIndex, 1)
        console.log(rooms)
    }
}

const findRoom = roomName => {
    return rooms.find(it => it.roomName === roomName)
}

webSocket.on('request', (req) => {
    const connection = req.accept()


    connection.on('message', (message) => {
        const data = JSON.parse(message.utf8Data)
        console.log(data);
        const user = findUser(data.name)

        switch (data.type) {
            case "create_room":
                createChatRoom(data.roomName, data.name, connection)
                break
            case "join_room":
                joinChatRoom(data.roomName, data.name, connection)

                break
            case "leave_room":
                leaveChatRoom(data.roomName, data.name)
                break

            case "store_user":
                if (user != null) {
                    //our user exists
                    connection.send(JSON.stringify({
                        type: 'user already exists'
                    }))
                    return

                }

                const newUser = {
                    name: data.name, conn: connection
                }
                users.push(newUser)
                break

            case "start_call":
                let userToCall = findUser(data.target)

                if (userToCall) {
                    connection.send(JSON.stringify({
                        type: "call_response", data: "user is ready for call"
                    }))
                } else {
                    connection.send(JSON.stringify({
                        type: "call_response", data: "user is not online"
                    }))
                }

                break

            case "create_offer":
                let userToReceiveOffer = findUser(data.target)

                if (userToReceiveOffer) {
                    userToReceiveOffer.conn.send(JSON.stringify({
                        type: "offer_received",
                        name: data.name,
                        data: data.data.sdp
                    }))
                }
                break

            case "create_answer":
                let userToReceiveAnswer = findUser(data.target)
                if (userToReceiveAnswer) {
                    userToReceiveAnswer.conn.send(JSON.stringify({
                        type: "answer_received",
                        name: data.name,
                        data: data.data.sdp
                    }))
                }
                break

            case "ice_candidate":
                let userToReceiveIceCandidate = findUser(data.target)
                if (userToReceiveIceCandidate) {
                    userToReceiveIceCandidate.conn.send(JSON.stringify({
                        type: "ice_candidate",
                        name: data.name,
                        data: {
                            sdpMLineIndex: data.data.sdpMLineIndex,
                            sdpMid: data.data.sdpMid,
                            sdpCandidate: data.data.sdpCandidate
                        }
                    }))
                }
                break


        }

    })

    connection.on('close', () => {
        users.forEach(user => {
            if (user.conn === connection) {
                users.splice(users.indexOf(user), 1)
            }
        })
    })


})

const findUser = username => {
    for (let i = 0; i < users.length; i++) {
        if (users[i].name === username)
            return users[i]
    }
}