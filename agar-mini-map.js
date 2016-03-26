// ==UserScript==
// @name         agar-mini-map
// @namespace    http://github.com/dimotsai/
// @version      0.46
// @description  This script will show a mini map and your location on agar.io
// @author       dimotsai
// @license      MIT
// @match        http://agar.io/*
// @require      http://cdn.jsdelivr.net/msgpack/1.05/msgpack.js
// @grant        none
// @run-at       document-body
// ==/UserScript==

$.getScript( "https://cdn.socket.io/socket.io-1.3.5.js" );
$.getScript( "http://cdn.jsdelivr.net/msgpack/1.05/msgpack.js" );
setTimeout(function()
{
    window.msgpack = this.msgpack;

    (function() {
        var _WebSocket = window._WebSocket = window.WebSocket;
        var $ = window.jQuery;
        var msgpack = window.msgpack;
        var options = {
            enableMultiCells: true,
            enableCross: true
        };

        // game states
        var agar_server = null;
        var map_server = null;
        var map_party = null;
        var map_room_id = null;
        var player_name = [];
        var players = [];
        var id_players = [];
        var user_players = [];
        var cells = [];
        var current_cell_ids = [];
        var start_x = 0,
            start_y = 0,
            end_x = 0,
            end_y = 0,
            length_x = 0,
            length_y = 0;
        var render_timer = null;
        var firstDiemensionCall = false;

        function miniMapConnectToServer() {
            try {
                //var host = 'http://localhost:5001';
                var host = '5.175.193.30:5001';
                map_server = io(host);
            } catch (e) {
                alert('Minimap not supported :(');
            }

            map_server.on('connect', function(event) {
                if (map_party != null)
                    map_server.send({type: 'restore_connection', agar_url: agar_server, party: map_party, room_id: map_room_id});
                //console.log(address + ' connected');
            });

            map_server.on('message', function(event) {
                if (event.type == 'room_confirm')
                {
                    if (event.room_id != '')
                    {
                        map_room_id = event.room_id;
                        map_party = event.party;
                        joinParty(event.party);
                    }
                    else
                    {
                        $('#input_party').val('')
                        disconnect();
                    }
                }
                else if (event.type == 'room_data')
                {
                    id_players = event.data.my_tokens;
                    user_players = event.data.user_tokens;
                } else if (event.type == 'room_info' && event.id !== undefined) {
                  $('#input_party').val(event.id);
                  connect();
                }


            });

            map_server.on('error', function(event) {
                map_server = null;
                console.error('failed to connect to map server');
            });

            map_server.on('close', function(event) {
                console.log('map server disconnected');
            });
        }

        function miniMapRender() {
            var canvas = window.mini_map;
            var ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (map_server != null && map_party != null)
            {
                var default_color = 'rgba(132, 132, 132, 1)';

                var id, token = null;

                for (id in id_players)
                {
                    token = id_players[id];
                    draw(token, token.color);
                    if (options.enableCross)
                        miniMapDrawCross(token.x, token.y, token.color, current_cell_ids.indexOf(token.id) === -1);
                }

                if (options.enableMultiCells)
                {
                    for (id in user_players)
                        draw(user_players[id], default_color);
                }

                function draw(token, color)
                {
                    var x = token.x * canvas.width;
                    var y = token.y * canvas.height;
                    var size = token.size * canvas.width;
                    ctx.beginPath();
                    ctx.arc(
                        x,
                        y,
                        size,
                        0,
                        2 * Math.PI,
                        false
                    );
                    ctx.closePath();
                    ctx.fillStyle = color;
                    ctx.fill();
                }

            }
        }

        function miniMapDrawCross(x, y, color, party) {
            var canvas = window.mini_map;
            var ctx = canvas.getContext('2d');

            if(party) {
              ctx.setLineDash([5, 5]);
            }
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, y * canvas.height);
            ctx.lineTo(canvas.width, y * canvas.height);
            ctx.moveTo(x * canvas.width, 0);
            ctx.lineTo(x * canvas.width, canvas.height);
            ctx.strokeStyle = color || '#FFFFFF';
            ctx.stroke();
            ctx.setLineDash([0]);
        }

        function miniMapDrawMiddleCross() {
            var canvas = window.mini_map;
            var ctx = canvas.getContext('2d');
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, canvas.height/2);
            ctx.lineTo(canvas.width, canvas.height/2);
            ctx.moveTo(canvas.width/2, 0);
            ctx.lineTo(canvas.width/2, canvas.height);
            ctx.closePath();
            ctx.strokeStyle = '#000000';
            ctx.stroke();
        }

        function miniMapCreateToken(id, color) {
            var mini_map_token = {
                id: id,
                color: color,
                x: 0,
                y: 0,
                size: 0
            };
            return mini_map_token;
        }

        function miniMapRegisterToken(id, token) {
            if (window.mini_map_tokens[id] === undefined) {
                window.mini_map_tokens[id] = token;
            }
        }

        function miniMapUnregisterToken(id) {
            if (window.mini_map_tokens[id] !== undefined) {
                delete window.mini_map_tokens[id];
            }
        }

        function miniMapIsRegisteredToken(id) {
            return window.mini_map_tokens[id] !== undefined;
        }

        function miniMapUpdateToken(id, x, y, size) {
            if (window.mini_map_tokens[id] !== undefined) {

                window.mini_map_tokens[id].x = x;
                window.mini_map_tokens[id].y = y;
                window.mini_map_tokens[id].size = size;

                return true;
            } else {
                return false;
            }
        }

        function miniMapUpdatePos(x, y) {
            window.mini_map_pos.text('x: ' + x.toFixed(0) + ', y: ' + y.toFixed(0));
        }

        function miniMapReset() {
            cells = [];
            window.mini_map_tokens = [];
            start_x = 0;
            start_y = 0;
            end_x = 0;
            end_y = 0;
            length_x = 0;
            length_y = 0;
            firstDiemensionCall = false;
        }

        function miniMapInit() {
            miniMapConnectToServer();
            window.mini_map_tokens = [];

            cells = [];
            current_cell_ids = [];
            start_x = 0;
            start_y = 0;
            end_x = 0;
            end_y = 0;
            length_x = 0;
            length_y = 0;

            // minimap dom
            if ($('#mini-map-wrapper').length === 0) {
                var wrapper = $('<div>').attr('id', 'mini-map-wrapper').css({
                    position: 'fixed',
                    bottom: 10,
                    right: 10,
                    width: 300,
                    height: 300,
                    background: 'rgba(128, 128, 128, 0.58)'
                });

                var mini_map = $('<canvas>').attr({
                    id: 'mini-map',
                    width: 300,
                    height: 300
                }).css({
                    width: '100%',
                    height: '100%',
                    position: 'relative'
                });

                wrapper.append(mini_map).appendTo(document.body);

                window.mini_map = mini_map[0];
            }

            // minimap renderer
            if (render_timer === null)
                render_timer = setInterval(miniMapRender, 1000 / 30);

            // minimap location
            if ($('#mini-map-pos').length === 0) {
                window.mini_map_pos = $('<div>').attr('id', 'mini-map-pos').css({
                    bottom: 10,
                    right: 10,
                    color: 'white',
                    fontSize: 15,
                    fontWeight: 800,
                    position: 'fixed'
                }).appendTo(document.body);
            }

            // minimap options
            if ($('#mini-map-options').length === 0) {
                window.mini_map_options = $('<div>').attr('id', 'mini-map-options').css({
                    bottom: 315,
                    right: 10,
                    color: '#666',
                    fontSize: 14,
                    position: 'fixed',
                    fontWeight: 400,
                    zIndex: 1000
                }).appendTo(document.body);

                var container = $('<div>')
                    .css({
                        background: 'rgba(200, 200, 200, 0.58)',
                        padding: 5,
                        borderRadius: 5
                    })
                    .hide();

                for (var name in options) {

                    var label = $('<label>').css({
                        display: 'block'
                    });

                    var checkbox = $('<input>').attr({
                        type: 'checkbox'
                    }).prop({
                        checked: options[name]
                    });

                    label.append(checkbox);
                    label.append(' ' + camel2cap(name));

                    checkbox.click(function(options, name) { return function(evt) {
                        options[name] = evt.target.checked;
                        console.log(name, evt.target.checked);
                    }}(options, name));

                    label.appendTo(container);
                }

                container.appendTo(window.mini_map_options);
                var form = $('<div>')
                    .addClass('form-inline')
                    .css({
                        opacity: 0.7,
                        marginTop: 2
                    })
                    .appendTo(window.mini_map_options);

                var form_group = $('<div>')
                    .addClass('form-group')
                    .appendTo(form);

                var setting_btn = $('<button>')
                    .addClass('btn')
                    .css({
                        float: 'right',
                        fontWeight: 800,
                        marginLeft: 2
                    })
                    .on('click', function() {
                        container.toggle();
                        setting_btn.blur();
                        return false;
                    })
                    .append($('<i>').addClass('glyphicon glyphicon-cog'))
                    .appendTo(form_group);

                //var help_btn = $('<button>')
                //    .addClass('btn')
                //    .text('?')
                //    .on('click', function(e) {
                //        window.open('https://github.com/dimotsai/agar-mini-map/#minimap-server');
                //        help_btn.blur();
                //        return false;
                //    })
                //    .appendTo(form_group);

                var addressInput = $('<input>')
                    .css({
                        marginLeft: 2
                    })
                    .attr('id', 'input_party')
                    .attr('placeholder', 'agarmap.com code')
                    .attr('type', 'text')
                    .addClass('form-control')
                    .appendTo(form_group);


                var connectBtn = $('<button>')
                    .attr('id', 'mini-map-connect-btn')
                    .css({
                        marginLeft: 2
                    })
                    .text('Connect')
                    .click(connect)
                    .addClass('btn')
                    .appendTo(form_group);
            }
        }

        var connect = function () {
            var connectBtn = $('#mini-map-connect-btn');
            map_server.send({type: 'room_connect', agar_url: agar_server, room_id: $('#input_party').val()});

            connectBtn.popover('destroy');
            connectBtn.text('Disconnect');


            connectBtn.off('click');
            connectBtn.on('click', disconnect);
            connectBtn.blur();
        };

        var disconnect = function() {
            var connectBtn = $('#mini-map-connect-btn')
            //players = id_players = user_players = [];
            connectBtn.text('Connect');
            connectBtn.off('click');
            connectBtn.on('click', connect);
            connectBtn.blur();
            //map_server.send({type: 'room_disconnect', agar_url: agar_server, room_id: map_room});
            //map_server.send({type: 'room_disconnect', agar_url: agar_server, room_id: map_room});
            map_server.emit('room_disconnect', {});
            map_party = map_room_id = null;

            //if (map_server)
            //    map_server.disconnect();
            //map_server = null;
            //miniMapReset();
        };

        // cell constructor
        function Cell(id, x, y, size, color, name) {
            cells[id] = this;
            this.id = id;
            this.ox = this.x = x;
            this.oy = this.y = y;
            this.oSize = this.size = size;
            this.color = color;
            this.points = [];
            this.pointsAcc = [];
            this.setName(name);
        }

        Cell.prototype = {
            id: 0,
            points: null,
            pointsAcc: null,
            name: null,
            nameCache: null,
            sizeCache: null,
            x: 0,
            y: 0,
            size: 0,
            ox: 0,
            oy: 0,
            oSize: 0,
            nx: 0,
            ny: 0,
            nSize: 0,
            updateTime: 0,
            updateCode: 0,
            drawTime: 0,
            destroyed: false,
            isVirus: false,
            isAgitated: false,
            wasSimpleDrawing: true,

            destroy: function() {
                delete cells[this.id];
                id = current_cell_ids.indexOf(this.id);
                -1 != id && current_cell_ids.splice(id, 1);
                this.destroyed = true;
                miniMapUnregisterToken(this.id);
            },
            setName: function(name) {
                this.name = name;
            },
            updatePos: function() {
                if (options.enableMultiCells || -1 != current_cell_ids.indexOf(this.id)) {
                    if (! miniMapIsRegisteredToken(this.id))
                    {
                        miniMapRegisterToken(
                            this.id,
                            miniMapCreateToken(this.id, this.color)
                        );
                    }

                    var size_n = this.nSize/length_x;
                    miniMapUpdateToken(this.id, (this.nx - start_x)/length_x, (this.ny - start_y)/length_y, size_n);
                }
            }
        };

        String.prototype.capitalize = function() {
            return this.charAt(0).toUpperCase() + this.slice(1);
        };

        function camel2cap(str) {
            return str.replace(/([A-Z])/g, function(s){return ' ' + s.toLowerCase();}).capitalize();
        };

        // create a linked property from slave object
        // whenever master[prop] update, slave[prop] update
        function refer(master, slave, prop) {
            Object.defineProperty(master, prop, {
                get: function(){
                    return slave[prop];
                },
                set: function(val) {
                    slave[prop] = val;
                },
                enumerable: true,
                configurable: true
            });
        };

        // extract a websocket packet which contains the information of cells
        function extractCellPacket(data, offset) {
            ////
            var dataToSend = {
                destroyQueue : [],
                nodes : [],
                nonVisibleNodes : []
            };
            ////

            var I = +new Date;
            var qa = false;
            var b = Math.random(), c = offset;
            var size = data.getUint16(c, true);
            c = c + 2;

            // Nodes to be destroyed (killed)
            for (var e = 0; e < size; ++e) {
                var p = cells[data.getUint32(c, true)],
                    f = cells[data.getUint32(c + 4, true)],
                    c = c + 8;
                p && f && (
                    f.destroy(),
                        f.ox = f.x,
                        f.oy = f.y,
                        f.oSize = f.size,
                        f.nx = p.x,
                        f.ny = p.y,
                        f.nSize = f.size,
                        f.updateTime = I,
                        dataToSend.destroyQueue.push(f.id));

            }

            // Nodes to be updated
            for (e = 0; ; ) {
                var d = data.getUint32(c, true);
                c += 4;
                if (0 == d) {
                    break;
                }
                ++e;
                var p = data.getInt32(c, true),
                    c = c + 4,
                    f = data.getInt32(c, true),
                    c = c + 4;
                g = data.getInt16(c, true);
                c = c + 2;
                for (var h = data.getUint8(c++), m = data.getUint8(c++), q = data.getUint8(c++), h = (h << 16 | m << 8 | q).toString(16); 6 > h.length; )
                    h = "0" + h;

                var h = "#" + h,
                    k = data.getUint8(c++),
                    m = !!(k & 1),
                    q = !!(k & 16);

                k & 2 && (c += 4);
                k & 4 && (c += 8);
                k & 8 && (c += 16);

                for (var n, k = ""; ; ) {
                    n = data.getUint16(c, true);
                    c += 2;
                    if (0 == n)
                        break;
                    k += String.fromCharCode(n)
                }

                n = k;
                k = null;

                var updated = false;
                // if d in cells then modify it, otherwise create a new cell
                cells.hasOwnProperty(d)
                    ? (k = cells[d],
                    k.updatePos(),
                    k.ox = k.x,
                    k.oy = k.y,
                    k.oSize = k.size,
                    k.color = h,
                    updated = true)
                    : (k = new Cell(d, p, f, g, h, n),
                    k.pX = p,
                    k.pY = f);

                k.isVirus = m;
                k.isAgitated = q;
                k.nx = p;
                k.ny = f;
                k.nSize = g;
                k.updateCode = b;
                k.updateTime = I;
                n && k.setName(n);

                // ignore food creation
                if (updated) {
                    dataToSend.nodes.push({
                        id: k.id,
                        x: k.nx,
                        y: k.ny,
                        size: k.nSize,
                        color: k.color
                    });
                }
            }

            // Destroy queue + nonvisible nodes
            b = data.getUint32(c, true);
            c += 4;
            for (e = 0; e < b; e++) {
                d = data.getUint32(c, true);
                c += 4, k = cells[d];
                null != k && k.destroy();
                dataToSend.nonVisibleNodes.push(d);
            }

            var packet = {
                type: 16,
                data: dataToSend
            }

            //miniMapSendRawData(msgpack.pack(packet));
        }

        // extract the type of packet and dispatch it to a corresponding extractor
        function extractPacket(event) {
            var c = 0;
            var data = new DataView(event.data);
            240 == data.getUint8(c) && (c += 5);
            var opcode = data.getUint8(c);
            c++;
            switch (opcode) {
                case 16: // cells data
                    extractCellPacket(data, c);
                    break;
                case 20: // cleanup ids
                    current_cell_ids = [];
                    break;
                case 32: // cell id belongs me
                    var id = data.getUint32(c, true);

                    if (current_cell_ids.indexOf(id) === -1)
                        current_cell_ids.push(id);

                    break;
                case 64: // get borders
                    if (!firstDiemensionCall) {
                      firstDiemensionCall = true;
                    } else {

                        start_x = Math.min(start_x, data.getFloat64(c, !0)), c += 8,
                        start_y = Math.min(start_y, data.getFloat64(c, !0)), c += 8,
                        end_x = Math.max(end_x, data.getFloat64(c, !0)), c += 8,
                        end_y = Math.max(end_y, data.getFloat64(c, !0)), c += 8,
                        center_x = (start_x + end_x) / 2,
                        center_y = (start_y + end_y) / 2,
                        length_x = Math.abs(start_x - end_x),
                        length_y = Math.abs(start_y - end_y);
                        console.log(start_x, start_y, end_x, end_y);
                    }

                    console.log(start_x, start_y, end_x, end_y);
                    break;
            }
        }

        window.my_tokens = function()
        {
            var tt = [];
            var user_tokens = [];
            if (current_cell_ids.length > 0)
            {
                for (var id in window.mini_map_tokens) {
                    var t = window.mini_map_tokens[id];
                    if (-1 != current_cell_ids.indexOf(t.id))
                        tt.push(t);
                    else if (options.enableMultiCells && t.size > 0.005)
                        user_tokens.push(t);
                }
            }
            return {my_tokens: tt, user_tokens: user_tokens}
        };

        // the injected point, overwriting the WebSocket constructor
        window.WebSocket = function(url, protocols) {
            console.log('Listen');

            if (protocols === undefined) {
                protocols = [];
            }

            var ws = new _WebSocket(url, protocols);

            refer(this, ws, 'binaryType');
            refer(this, ws, 'bufferedAmount');
            refer(this, ws, 'extensions');
            refer(this, ws, 'protocol');
            refer(this, ws, 'readyState');
            refer(this, ws, 'url');

            this.send = function(data){
                return ws.send.call(ws, data);
            };

            this.close = function(){
                return ws.close.call(ws);
            };

            this.onopen = function(event){};
            this.onclose = function(event){};
            this.onerror = function(event){};
            this.onmessage = function(event){};

            ws.onopen = function(event) {
                miniMapInit();
                agar_server = url;
                if (this.onopen)
                    return this.onopen.call(ws, event);
            }.bind(this);

            ws.onmessage = function(event) {
                extractPacket(event);
                if (map_server != null && map_server.connected && map_party != null)
                    map_server.emit('game_message', window.my_tokens());
                if (this.onmessage)
                    return this.onmessage.call(ws, event);
            }.bind(this);

            ws.onclose = function(event) {
                if (this.onclose)
                    return this.onclose.call(ws, event);
            }.bind(this);

            ws.onerror = function(event) {
                if (this.onerror)
                    return this.onerror.call(ws, event);
            }.bind(this);
        };

        window.WebSocket.prototype = _WebSocket;

        $(window.document).ready(function() {
            miniMapInit();
        });

        $(document).on('click', '[data-itr="play"]', function(){
          miniMapReset();
        });


        $(document).on('click', '[data-itr="create_party"]', function(){
          var currentLocation = window.location.hash;
          var locationIntrvl = setInterval(function(){
            console.log(window.location.hash, currentLocation);
            if (window.location.hash !== currentLocation) {
              clearInterval(locationIntrvl);

                map_server.send({type: 'room_create', party: window.location.hash});

            }
          }, 100);
        });

        $(window).load(function() {
            var main_canvas = document.getElementById('canvas');
            if (main_canvas && main_canvas.onmousemove) {
                document.onmousemove = main_canvas.onmousemove;
                main_canvas.onmousemove = null;
            }
        });
    })();
},1500);
