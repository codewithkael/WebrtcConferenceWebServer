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
        endCall: "EndCall",
        callResponse: "CallResponse",
        offer: "Offer",
        answer: "Answer",
        ice: "Ice",
        roomStatus: "RoomStatus",
        leaveAllRooms: "LeaveAllRooms",
        newSession:"NewSession",
    }

}

server.listen(4000, () => {

})

const webSocket = new Socket({httpServer: server})

const users = []
const rooms = []

setInterval(function() {
    // Iterate over the rooms
    rooms.forEach((room, roomIndex) => {
        // Filter out disconnected members
        room.members = room.members.filter(member => {
            const isConnected = member.conn.connected; // Assuming .connected can be used to check the connection status
            if (!isConnected) {
                // Remove the user from the users array if not connected
                const userIndex = users.findIndex(user => user.conn === member.conn);
                if (userIndex !== -1) {
                    users.splice(userIndex, 1);
                }
            }
            return isConnected;
        });

        // If a room is empty after filtering, remove it
        if (room.members.length === 0) {
            rooms.splice(roomIndex, 1);
        }
    });

    // Optionally, broadcast the updated rooms list to all users
    updateRoomsForUsers();
}, 10000);


const createChatRoom = (roomName, username, connection) => {

    const room = findRoom(roomName)
    if (room) {
        console.log(rooms)
        return
    }
    leaveUserFromAllRooms(username)
    rooms.push({roomName: roomName, owner: username, members: [{username: username, conn: connection}]})
    updateRoomsForUsers()
    console.log(rooms)
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

    sendJoiningNewSessionToOtherRoomMembers(username,room)
    room.members.push({username: username, conn: connection})
    updateRoomsForUsers()
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
                    sendDataToUser(userToCall.conn, {
                        type: SignalTypes().startCall,name: data.name
                    })
                }

                break

            case SignalTypes().offer:
                let userToReceiveOffer = findUser(data.target)

                if (userToReceiveOffer) {
                    sendDataToUser(userToReceiveOffer.conn, {
                        type: SignalTypes().offer,
                        name: data.name,
                        data: data.data,
                    })
                }
                break

            case SignalTypes().answer:
                let userToReceiveAnswer = findUser(data.target)
                if (userToReceiveAnswer) {
                    sendDataToUser(userToReceiveAnswer.conn, {
                        type: SignalTypes().answer,
                        name: data.name,
                        data: data.data
                    })
                }
                break

            case SignalTypes().ice:
                let userToReceiveIceCandidate = findUser(data.target)
                if (userToReceiveIceCandidate) {
                    sendDataToUser(userToReceiveIceCandidate.conn, {
                        type: SignalTypes().ice,
                        name: data.name,
                        data: data.data
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

const sendJoiningNewSessionToOtherRoomMembers = (username,room) =>{
    room.members.forEach( user => {
        sendDataToUser(user.conn, {type: SignalTypes().newSession,name:username})
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