const http = require("http")
const Socket = require("websocket").server
const server = http.createServer(() => {
})
const SignalTypes = () => {
    return {
        storeUser: "StoreUser",
        createRoom: "CreateRoom",
        joinRoom: "JoinRoom",
        leaveRoom: "LeaveRoom",
        startCall: "StartCall",
        callResponse: "CallResponse",
        offer: "Offer",
        answer: "Answer",
        iceCandidate: "IceCandidate",
        roomStatus: "RoomStatus",
        leaveAllRooms: "LeaveAllRooms"
    }

}

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
    leaveUserFromAllRooms(username)
    rooms.push({roomName: roomName, owner: username, members: [{username: username, connection: connection}]})
    updateRoomsForUsers()
    console.log(rooms)
}

const removeChatRoom = (roomName) => {
    const index = rooms.findIndex(object => object.roomName === roomName);
    if (index !== -1) {
        rooms.splice(index, 1)
    }
    updateRoomsForUsers()

}
const joinChatRoom = (roomName, username, connection) => {
    leaveUserFromAllRooms(username)
    const room = findRoom(roomName)
    if (!room) {
        return;
    }
    const user = room.members.find(it => it.username === username)
    if (user) {
        console.log(user)
        console.log("user exists")
        return;
    }

    room.members.push({username: username, connection: connection})
    updateRoomsForUsers()

    console.log(rooms)
}

const leaveChatRoom = (roomName, username) => {
    const room = findRoom(roomName)
    if (room) {
        const userIndex = room.members.findIndex(object => object.username === username);
        room.members.splice(userIndex, 1)
        console.log(rooms)
    }
    updateRoomsForUsers()
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
            case SignalTypes().storeUser:
                if (user != null) {
                    //our user exists
                    sendDataToUser(connection, {
                        type: 'user already exists'
                    })
                    return

                }

                const newUser = {
                    name: data.name, conn: connection
                }
                users.push(newUser)
                updateRoomsForUser(newUser)
                break

            case SignalTypes().createRoom:
                createChatRoom(data.data, data.name, connection)
                break
            case SignalTypes().joinRoom:
                joinChatRoom(data.data, data.name, connection)

                break
            case SignalTypes().leaveRoom:
                leaveChatRoom(data.data, data.name)
                break

            case SignalTypes().leaveAllRooms:
                leaveUserFromAllRooms(data.name)
                break

            case SignalTypes().startCall:
                let userToCall = findUser(data.target)

                if (userToCall) {
                    sendDataToUser(connection, {
                        type: SignalTypes().callResponse, data: "user is ready for call"
                    })
                } else {
                    sendDataToUser(connection, {
                        type: SignalTypes().callResponse, data: "user is not online"
                    })
                }

                break

            case SignalTypes().offer:
                let userToReceiveOffer = findUser(data.target)

                if (userToReceiveOffer) {
                    sendDataToUser(userToReceiveOffer.conn, {
                        type: SignalTypes().offer,
                        name: data.name,
                        data: data.data.sdp
                    })
                }
                break

            case SignalTypes().answer:
                let userToReceiveAnswer = findUser(data.target)
                if (userToReceiveAnswer) {
                    sendDataToUser(userToReceiveAnswer.conn, {
                        type: SignalTypes().answer,
                        name: data.name,
                        data: data.data.sdp
                    })
                }
                break

            case SignalTypes().iceCandidate:
                let userToReceiveIceCandidate = findUser(data.target)
                if (userToReceiveIceCandidate) {
                    sendDataToUser(userToReceiveIceCandidate.conn, {
                        type: SignalTypes().iceCandidate,
                        name: data.name,
                        data: {
                            sdpMLineIndex: data.data.sdpMLineIndex,
                            sdpMid: data.data.sdpMid,
                            sdpCandidate: data.data.sdpCandidate
                        }
                    })
                }
                break
        }
    })

    connection.on('close', () => {
        users.forEach(user => {
            if (user.conn === connection) {
                users.splice(users.indexOf(user), 1)
                leaveUserFromAllRooms(user.username)
            }
        })
    })


})

const getRoomDetails = () => {
    return rooms.map(it => ({roomName: it.roomName, population: it.members.length}))
}

const updateRoomsForUsers = () => {
    console.log(getRoomDetails())
    users.forEach(user => {
        sendDataToUser(user.conn, {type: SignalTypes().roomStatus, data: getRoomDetails()})
    })
}

const updateRoomsForUser = (user) => {
    sendDataToUser(user.conn, {type: SignalTypes().roomStatus, data: getRoomDetails()})
}

const leaveUserFromAllRooms = (username) => {
    //find the user in each room
    rooms.forEach(room => {
        room.members.forEach(member => {
            if (member.username === username) {
                leaveChatRoom(room.roomName, member.username)
            }
        })
    })
}

const sendDataToUser = (connection, data) => {
    connection.send(JSON.stringify(data))
}

const findUser = username => {
    for (let i = 0; i < users.length; i++) {
        if (users[i].name === username)
            return users[i]
    }
}