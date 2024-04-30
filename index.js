let express = require('express');
var app = require('express')();
var http = require('http').Server(app);
let io = require('socket.io')(http);
const axios = require('axios')

const SecretKey = process.env['SecretKey'];

var connectedUsers = 0;
var messages = [];
var connections = {};
var muted = [];

function removeA(arr) {
    var what, a = arguments, L = a.length, ax;
    while (L > 1 && arr.length) {
        what = a[--L];
        while ((ax = arr.indexOf(what)) !== -1) {
            arr.splice(ax, 1);
        }
    }
    return arr;
}

function sendServerMessage(socket, message) {
    socket.emit('chat message', {
        displayname: "SERVER",
        message: message,
        rank: 3,
        thumbnail: "https://tr.rbxcdn.com/c4265017c98559993061733b1125a23c/420/420/AvatarHeadshot/Png"
    })
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.get('/ip', function (req, res) {
    axios.get('http://ip-api.com/json').then(reb => {
        res.send(reb.data)
    })
})

app.post('/send/:userid', function (req, res) {
    const event = req.body.event;
    const data = req.body.data;
    const InSecretKey = req.get("SecretKey")
    if (InSecretKey !== SecretKey) {
        res.send({ success: false, error: "401 Unauthorized" })
        return;
    }
    if (typeof event == 'undefined' || typeof data == 'undefined') {
        res.send({ success: false, error: "400 Bad Request" })
        return;
    }
    if (req.params.userid == "all") {
        io.emit(event, data)
        res.send({ success: true })
    } else {
        var userid = req.params.userid
        userid = parseInt(userid, 10)
        userid = userid.toString()
        if (connections[userid]) {
            connections[userid].forEach(function (connection) {
                connection.emit(event, data)
            })
            res.send({ success: true })
        } else {
            res.send({ success: false, error: "404 Not Found" })
        }
        //User Socket emit
    }
})

io.on('connection', function (socket) {
    socket.on('authenticate', function (key) {
        axios
            .post('https://bloxyroll.000webhostapp.com/php/getdata.php', {
                SecretKey: SecretKey,
                UserKey: key
            })
            .then(res => {
                if (res.status === 200) {
                    var displayname, userid, rank, thumbnail;
                    var data = res.data;
                    var displayname = data.displayname;
                    var userid = data.userid;
                    var rank = data.rank;
                    var thumbnail = data.thumbnail;
                    if (connections[userid.toString()]) {
                        connections[userid.toString()].push(socket)
                    } else {
                        connections[userid.toString()] = [socket]
                    }
                    if (muted.includes(userid.toString())) {
                        sendServerMessage(socket, "You can not chat, you are muted.");
                    }
                    connectedUsers++
                    io.emit('count users', connectedUsers)
                    console.log('A user connected.');
                    socket.on('chat message', function (msg) {
                        if (msg.toLowerCase().startsWith("!mute")) {
                            if (rank > 0 && rank <= 3) {
                                muteid = msg.trim().substring(6)
                                parsed = parseInt(muteid);
                                if (isNaN(parsed)) { sendServerMessage(socket, "Proper usage is !mute <userId>"); } else {
                                    if (muted.includes(muteid.toString())) {
                                        sendServerMessage(socket, "User is already Muted");
                                    } else {
                                        muted.push(muteid.toString());
                                        sendServerMessage(socket, "User has been Muted");
                                        if (connections[muteid]) {
                                            connections[muteid].forEach(function (connection) {
                                                sendServerMessage(connection, "You have been Muted.")
                                            })
                                        }
                                    }
                                }
                            } else {
                                sendServerMessage(socket, "You can not execute this command!");
                            }
                        } else if (msg.toLowerCase().startsWith("!unmute")) {
                            if (rank > 0 && rank <= 3) {
                                muteid = msg.trim().substring(8)
                                parsed = parseInt(muteid);
                                if (isNaN(parsed)) { sendServerMessage(socket, "Proper usage is !unmute <userId>"); } else {
                                    if (!muted.includes(muteid.toString())) {
                                        sendServerMessage(socket, "User is not muted");
                                    } else {
                                        removeA(muted, muteid.toString());
                                        sendServerMessage(socket, "User has been Unmuted");
                                        if (connections[muteid.toString()]) {
                                            connections[muteid.toString()].forEach(function (connection) {
                                                sendServerMessage(connection, "You have been Unmuted.")
                                            })
                                        }
                                    }
                                }
                            } else {
                                sendServerMessage(socket, "You can not execute this command!");
                            }
                        } else if (muted.includes(userid.toString())) {
                            sendServerMessage(socket, "You can not chat, you are muted.");
                        } else {
                            io.emit('chat message', { displayname: displayname, message: msg, userid: userid, rank: rank, thumbnail: thumbnail });
                            if (messages.length >= 20) {
                                messages.shift()
                            }
                            messages.push({ displayname: displayname, message: msg, userid: userid, rank: rank, thumbnail: thumbnail })
                        }
                    });

                    socket.on('disconnect', function () {
                        if (connections[userid.toString()].length == 1) {
                            delete connections[userid.toString()]
                        } else {
                            connections[userid.toString()] = removeA(connections[userid.toString()], socket)
                        }
                        connectedUsers--;
                        io.emit('count users', connectedUsers)
                        console.log('A user disconnected');
                    });
                } else {
                    socket.emit('chat message', {
                        displayname: "SERVER",
                        message: "An Error Occured While Connecting you to Chat, Reload page to try again",
                        rank: 3,
                        thumbnail: "https://tr.rbxcdn.com/c4265017c98559993061733b1125a23c/420/420/AvatarHeadshot/Png"
                    })
                    console.log(res)
                }
            })
            .catch(error => {
                socket.emit('chat message', {
                    displayname: "SERVER",
                    message: "An Error Occured While Connecting you to Chat",
                    rank: 3,
                    thumbnail: "https://tr.rbxcdn.com/c4265017c98559993061733b1125a23c/420/420/AvatarHeadshot/Png"
                })
                console.log(error)
            });
    })

    messages.forEach(function (msg) {
        socket.emit("chat message", msg)
    })

    socket.on('count users', function () {
        io.emit('count users', connectedUsers)
    })
});

http.listen(3000, function () {
    console.log('listening on *:3000');
});
