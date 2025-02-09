<script>
import { mapState, mapActions } from 'vuex';

export default {
    data() {
        return {
            roomCode: "",
            username: "",
            isCreating: false,
            isJoining: false
        };
    },
    computed: {
        ...mapState({
            isConnected: state => state.isConnected,
            playerId: state => state.playerId,
            error: state => state.error,
            gameState: state => state.gameState,
            currentRoomCode: state => state.roomCode
        }),
        loadingMessage() {
            if (!this.isConnected) return 'Connecting to server...';
            if (!this.playerId) return 'Getting player ID...';
            if (this.isCreating) return 'Creating room...';
            if (this.isJoining) return 'Joining room...';
            return '';
        },
        isLoading() {
            return !this.isConnected || !this.playerId || this.isCreating || this.isJoining;
        },
        isValid() {
            return this.username.trim().length >= 2;
        },
        errorMessage() {
            if (this.error === "Game already in progress") {
                return "Cannot join - Game is already in progress";
            }
            if (this.error === "Room is full") {
                return "Cannot join - Room is full (max 4 players)";
            }
            if (this.error === "Room not found") {
                return "Room not found - Please check the code";
            }
            return this.error;
        }
    },
    methods: {
        ...mapActions(['createRoom', 'joinRoom', 'saveGameState']),
        async handleCreateRoom() {
            if (!this.playerId || this.isCreating || !this.isValid) return;
            
            this.isCreating = true;
            try {
                await this.createRoom({
                    playerId: this.playerId,
                    username: this.username.trim()
                });
                this.saveGameState();
                this.$emit('room-joined');
            } catch (error) {
                console.error('Failed to create room:', error);
            } finally {
                this.isCreating = false;
            }
        },
        async handleJoinRoom() {
            if (!this.playerId || this.isJoining || this.roomCode.length !== 4 || !this.isValid) return;
            
            this.isJoining = true;
            try {
                await this.joinRoom({ 
                    code: this.roomCode, 
                    playerId: this.playerId,
                    username: this.username.trim()
                });
                this.saveGameState();
                this.$emit('room-joined');
            } catch (error) {
                console.error('Failed to join room:', error);
            } finally {
                this.isJoining = false;
            }
        }
    },
    watch: {
        error(newError) {
            if (newError) {
                this.isCreating = false;
                this.isJoining = false;
            }
        },
        currentRoomCode(newCode) {
            if (newCode) {
                this.isCreating = false;
                this.isJoining = false;
            }
        }
    }
};
</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
        <div class="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
            <h1 class="text-3xl font-bold text-center text-gray-800 mb-8">Code Breaker</h1>
            
            <div v-if="loadingMessage" class="mb-4 p-3 bg-yellow-100 text-yellow-700 rounded-md">
                {{ loadingMessage }}
            </div>
            
            <div v-if="error" class="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                {{ errorMessage }}
            </div>

            <div class="space-y-4">
                <div class="space-y-2">
                    <input
                        v-model="username"
                        type="text"
                        placeholder="Enter your username"
                        :disabled="isLoading"
                        class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                    <p v-if="username && !isValid" class="text-sm text-red-500">
                        Username must be at least 2 characters
                    </p>
                </div>

                <button
                    @click="handleCreateRoom"
                    :disabled="isLoading || !isValid"
                    class="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {{ isCreating ? 'Creating Room...' : 'Create New Room' }}
                </button>

                <div class="relative">
                    <div class="absolute inset-0 flex items-center">
                        <div class="w-full border-t border-gray-300"></div>
                    </div>
                    <div class="relative flex justify-center text-sm">
                        <span class="px-2 bg-white text-gray-500">Or</span>
                    </div>
                </div>

                <div class="space-y-2">
                    <input
                        v-model="roomCode"
                        type="text"
                        maxlength="4"
                        placeholder="Enter Room Code"
                        :disabled="isLoading"
                        class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                    <button
                        @click="handleJoinRoom"
                        :disabled="isLoading || roomCode.length !== 4 || !isValid"
                        class="w-full py-3 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {{ isJoining ? 'Joining Room...' : 'Join Room' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template> 