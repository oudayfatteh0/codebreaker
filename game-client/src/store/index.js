import { createStore } from 'vuex';

export default createStore({
    state: {
        ws: null,
        gameState: null,
        playerId: null,
        username: null,
        isConnected: false,
        roomCode: null,
        error: null,
        timerRunning: false,
        currentTurn: null,
        lastTimerUpdate: null,
        notifications: []
    },
    mutations: {
        SET_WEBSOCKET(state, ws) {
            state.ws = ws;
        },
        SET_GAME_STATE(state, gameState) {
            state.gameState = gameState;
        },
        SET_PLAYER_ID(state, id) {
            state.playerId = id;
        },
        SET_CONNECTED(state, status) {
            state.isConnected = status;
        },
        SET_ROOM_CODE(state, code) {
            state.roomCode = code;
        },
        SET_ERROR(state, error) {
            state.error = error;
        },
        RESET_STATE(state) {
            state.isConnected = false;
            state.playerId = null;
            state.roomCode = null;
            state.gameState = null;
            state.error = null;
            state.timerRunning = false;
            state.currentTurn = null;
            state.lastTimerUpdate = null;
        },
        SET_USERNAME(state, username) {
            state.username = username;
        },
        SET_TIMER_STATE(state, { running, currentTurn }) {
            state.timerRunning = running;
            state.currentTurn = currentTurn;
            state.lastTimerUpdate = Date.now();
        },
        ADD_NOTIFICATION(state, message) {
            state.notifications.push({
                id: Date.now(),
                message,
                timestamp: new Date()
            });
            if (state.notifications.length > 5) {
                state.notifications.shift();
            }
        }
    },
    actions: {
        connect({ commit }) {
            return new Promise((resolve) => {
                const ws = new WebSocket("ws://localhost:3000");

                ws.onopen = () => {
                    console.log("Connected to game server");
                    commit('SET_CONNECTED', true);
                    commit('SET_WEBSOCKET', ws);
                    ws.send(JSON.stringify({ action: "requestPlayerId" }));
                    resolve();
                };

                ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    console.log("Received data:", data);

                    if (data.action === 'NOTIFICATION') {
                        commit('ADD_NOTIFICATION', data.message);
                        return;
                    }

                    if (data.error) {
                        commit('SET_ERROR', data.error);
                        return;
                    }

                    if (data.playerId) {
                        commit('SET_PLAYER_ID', data.playerId);
                        return;
                    }

                    if (data.action === 'TIMER_START') {
                        commit('SET_TIMER_STATE', { 
                            running: true, 
                            currentTurn: data.currentTurn 
                        });
                        return;
                    }

                    if (data.gameState) {
                        commit('SET_GAME_STATE', data.gameState);
                    }
                    
                    if (data.roomCode) {
                        commit('SET_ROOM_CODE', data.roomCode);
                    }
                };

                ws.onerror = (err) => {
                    console.error("WebSocket error:", err);
                    commit('SET_CONNECTED', false);
                    commit('SET_ERROR', "Connection error");
                };

                ws.onclose = () => {
                    console.log("Disconnected from game server");
                    commit('RESET_STATE');
                };
            });
        },

        createRoom({ state, commit }, { playerId, username }) {
            return new Promise((resolve, reject) => {
                if (state.ws?.readyState === WebSocket.OPEN) {
                    commit('SET_ERROR', null);
                    commit('SET_USERNAME', username);
                    state.ws.send(JSON.stringify({ 
                        action: "createRoom",
                        playerId,
                        username
                    }));
                    resolve();
                } else {
                    const error = "Not connected to server";
                    commit('SET_ERROR', error);
                    reject(error);
                }
            });
        },

        joinRoom({ state, commit }, { code, playerId, username }) {
            return new Promise((resolve, reject) => {
                if (state.ws?.readyState === WebSocket.OPEN) {
                    commit('SET_ERROR', null);
                    commit('SET_USERNAME', username);
                    state.ws.send(JSON.stringify({ 
                        action: "joinRoom", 
                        roomCode: code,
                        playerId,
                        username
                    }));
                    resolve();
                } else {
                    const error = "Not connected to server";
                    commit('SET_ERROR', error);
                    reject(error);
                }
            });
        },

        sendGuess({ state }, guess) {
            if (state.ws?.readyState === WebSocket.OPEN) {
                state.ws.send(JSON.stringify({ 
                    action: "guess", 
                    guess,
                    playerId: state.playerId,
                    roomCode: state.roomCode
                }));
            }
        },

        handleTimerStart({ commit, state }, currentTurn) {
            commit('SET_TIMER_STATE', { running: true, currentTurn });
        },

        startGame({ state }) {
            if (state.ws?.readyState === WebSocket.OPEN) {
                state.ws.send(JSON.stringify({ 
                    action: "startGame",
                    playerId: state.playerId,
                    roomCode: state.roomCode
                }));
            }
        },

        retryGame({ state }) {
            if (state.ws?.readyState === WebSocket.OPEN) {
                state.ws.send(JSON.stringify({ 
                    action: "retryGame",
                    playerId: state.playerId,
                    roomCode: state.roomCode
                }));
            }
        },

        exitGame({ state, commit, dispatch }) {
            if (state.ws) {
                state.ws.close();
            }
            commit('RESET_STATE');
            dispatch('connect');
        }
    },
    getters: {
        isConnected: state => state.isConnected,
        playerId: state => state.playerId,
        roomCode: state => state.roomCode,
        gameState: state => state.gameState,
        error: state => state.error
    }
}); 