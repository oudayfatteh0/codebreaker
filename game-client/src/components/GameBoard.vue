<script>
import { mapState, mapActions } from 'vuex';

export default {
    data() {
        return {
            guess: "",
            timeLeft: 20,
            timerInterval: null
        };
    },
    computed: {
        ...mapState({
            gameState: state => state.gameState,
            playerId: state => state.playerId,
            isConnected: state => state.isConnected,
            timerRunning: state => state.timerRunning,
            currentTurn: state => state.currentTurn,
            lastTimerUpdate: state => state.lastTimerUpdate,
            roomCode: state => state.roomCode,
            notifications: state => state.notifications
        }),
        guessHistory() {
            const currentPlayer = this.gameState?.players?.find(
                player => player.id === this.playerId
            );
            return currentPlayer ? currentPlayer.guesses || [] : [];
        },
        isMyTurn() {
            return this.currentTurn !== null && 
                   this.gameState?.players?.[this.currentTurn]?.id === this.playerId;
        },
        currentPlayerName() {
            if (!this.gameState?.players) return 'Loading...';
            
            const currentPlayer = this.gameState.players[this.gameState.currentTurn];
            if (!currentPlayer) return 'Loading...';

            const name = currentPlayer.username || 'Anonymous';
            return currentPlayer.id === this.playerId ? `${name} (You)` : name;
        },
        winnerName() {
            if (!this.gameState?.winner) return null;
            const winner = this.gameState.players.find(p => p.id === this.gameState.winner);
            return winner?.username || 'Anonymous';
        },
        turnTimeLeft() {
            if (!this.gameState?.turnStartTime) return 20;
            const elapsed = Math.floor((Date.now() - this.gameState.turnStartTime) / 1000);
            return Math.max(0, 20 - elapsed);
        },
        hasGuessed() {
            const currentPlayer = this.gameState?.players?.find(
                player => player.id === this.playerId
            );
            return currentPlayer?.guesses?.length > 0;
        },
        isAdmin() {
            return this.gameState?.adminId === this.playerId;
        },
        showStartButton() {
            return this.isAdmin && 
                   !this.gameState?.started && 
                   this.gameState?.players?.length > 1;
        }
    },
    methods: {
        ...mapActions(['sendGuess', 'startGame', 'retryGame', 'exitGame']),
        submitGuess() {
            if (this.guess.length === 4 && /^\d{4}$/.test(this.guess) && this.isMyTurn) {
                this.sendGuess(this.guess);
                this.guess = "";
            }
        },
        copyRoomCode() {
            navigator.clipboard.writeText(this.roomCode)
                .then(() => {
                    // Could add a toast notification here
                    console.log('Room code copied!');
                })
                .catch(err => {
                    console.error('Failed to copy room code:', err);
                });
        },
        startTimer() {
            this.stopTimer();
            this.timeLeft = 20;
            
            this.timerInterval = setInterval(() => {
                if (this.timeLeft > 0) {
                    this.timeLeft--;
                } else {
                    this.stopTimer();
                }
            }, 1000);
        },
        stopTimer() {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        },
        async handleExit() {
            await this.exitGame();
            this.$emit('exit');
        },
        getInitials(username) {
            if (!username) return '?';
            return username
                .split(' ')
                .map(word => word[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
        },
        getPlayerColor(username) {
            const colors = [
                'bg-pink-100 text-pink-800',
                'bg-purple-100 text-purple-800',
                'bg-indigo-100 text-indigo-800',
                'bg-blue-100 text-blue-800',
                'bg-cyan-100 text-cyan-800',
                'bg-teal-100 text-teal-800',
                'bg-emerald-100 text-emerald-800',
                'bg-lime-100 text-lime-800',
                'bg-amber-100 text-amber-800',
                'bg-orange-100 text-orange-800'
            ];
            
            // Generate a consistent index based on username
            const index = [...username].reduce((acc, char) => acc + char.charCodeAt(0), 0);
            return colors[index % colors.length];
        }
    },
    watch: {
        lastTimerUpdate(newVal) {
            if (newVal && this.isMyTurn) {
                this.startTimer();
            } else {
                this.stopTimer();
            }
        },
        'gameState.gameOver'(newVal) {
            if (newVal) {
                this.stopTimer();
            }
        }
    },
    beforeUnmount() {
        this.stopTimer();
    }
};
</script>

<template>
    <!-- Add this at the top level of your template -->
    <div 
        class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs w-full"
        style="pointer-events: none;"
    >
        <TransitionGroup 
            name="notification"
            tag="div"
            class="space-y-2"
        >
            <div
                v-for="notification in notifications"
                :key="notification.id"
                class="bg-black/75 text-white px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm"
                style="pointer-events: auto;"
            >
                <p class="text-sm">{{ notification.message }}</p>
                <p class="text-xs text-gray-400">
                    {{ new Date(notification.timestamp).toLocaleTimeString() }}
                </p>
            </div>
        </TransitionGroup>
    </div>

    <!-- Add a fixed players overlay at the top level -->
    <div v-if="gameState" class="fixed top-4 right-4 z-50">
        <!-- Player Count Bubble -->
        <div class="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-sm text-gray-600 shadow-md mb-2 text-center">
            {{ gameState.players.length }}/4
        </div>
        
        <!-- Player Avatars -->
        <div class="flex flex-col gap-2">
            <div 
                v-for="player in gameState.players" 
                :key="player.id"
                class="relative group"
            >
                <!-- Avatar Circle -->
                <div 
                    :class="[
                        'w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-md transition-all duration-200',
                        getPlayerColor(player.username),
                        player.id === gameState.adminId ? 'border-green-400' : 'border-white',
                        player.id === gameState.players[gameState.currentTurn]?.id ? 'ring-2 ring-blue-300 scale-110' : '',
                        'hover:scale-105'
                    ]"
                >
                    <span class="text-sm font-semibold">
                        {{ getInitials(player.username) }}
                    </span>
                </div>
                
                <!-- Full Name Overlay -->
                <div class="absolute left-full ml-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div class="flex items-center">
                        <!-- Name Background -->
                        <div :class="[
                            'py-1 px-3 rounded-full shadow-md whitespace-nowrap',
                            getPlayerColor(player.username)
                        ]">
                            <span class="font-medium">{{ player.username }}</span>
                            <div class="flex gap-1 text-xs">
                                <span v-if="player.id === playerId" 
                                    class="bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full">
                                    You
                                </span>
                                <span v-if="player.id === gameState.adminId" 
                                    class="bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full">
                                    Admin
                                </span>
                                <span v-if="player.id === gameState.players[gameState.currentTurn]?.id" 
                                    class="bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded-full">
                                    Current Turn
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Current Player Dot -->
                <span 
                    v-if="player.id === playerId"
                    class="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"
                ></span>
            </div>
        </div>
    </div>

    <div class="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 p-6">
        <!-- Loading State -->
        <div v-if="!gameState" class="flex items-center justify-center min-h-screen">
            <div class="text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                <p class="text-xl text-gray-700">{{ isConnected ? 'Joining game...' : 'Connecting to game...' }}</p>
            </div>
        </div>

        <div v-else class="max-w-4xl mx-auto">
            <!-- Header Section -->
            <div class="bg-white rounded-lg shadow-lg p-6 mb-6 relative">
                <h1 class="text-3xl font-bold text-center text-indigo-800 mb-4">Code Breaker</h1>
                
                <!-- Room Code -->
                <div class="relative flex justify-center mb-4">
                    <div class="inline-flex items-center bg-blue-50 px-6 py-3 rounded-full shadow-sm">
                        <span class="font-mono font-bold text-xl text-blue-700">{{ roomCode }}</span>
                        <button 
                            @click="copyRoomCode" 
                            class="ml-2 p-1 hover:bg-blue-100 rounded-full transition-colors"
                            title="Copy room code"
                        >
                            📋
                        </button>
                    </div>
                </div>

                <!-- Waiting State - Show expanded player info -->
                <div v-if="!gameState.started" class="mt-6">
                    <div class="mb-6">
                        <h2 class="text-lg font-semibold mb-3 text-center">Connected Players</h2>
                        <div class="flex flex-wrap justify-center gap-4">
                            <div 
                                v-for="player in gameState.players" 
                                :key="player.id"
                                class="flex items-center gap-2 px-4 py-2 rounded-full bg-white border-2"
                                :class="[
                                    player.id === gameState.adminId ? 'border-green-400' : 'border-gray-200'
                                ]"
                            >
                                <div 
                                    class="w-8 h-8 rounded-full flex items-center justify-center"
                                    :class="getPlayerColor(player.username)"
                                >
                                    <span class="text-sm font-semibold">
                                        {{ getInitials(player.username) }}
                                    </span>
                                </div>
                                <span class="font-medium">{{ player.username }}</span>
                                <span v-if="player.id === playerId" class="text-xs text-blue-600">(You)</span>
                            </div>
                        </div>
                        <p class="text-sm text-gray-600 mt-2 text-center">
                            {{ gameState.players.length }}/4 players
                        </p>
                    </div>

                    <div class="text-center">
                        <button 
                            v-if="showStartButton"
                            @click="startGame"
                            class="py-2 px-6 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 focus:ring-4 focus:ring-green-200 transition-all"
                        >
                            Start Game
                        </button>
                        <p class="text-sm text-gray-600 mt-2">
                            {{ gameState.players.length === 1 ? 'Waiting for more players to join...' : showStartButton ? 'You can start the game now!' : 'Waiting for admin to start the game...' }}
                        </p>
                    </div>
                </div>
            </div>

            <!-- Only show game content if game has started -->
            <template v-if="gameState.started">
                <!-- Game Section -->
                <div class="grid md:grid-cols-2 gap-6">
                    <!-- Input Section -->
                    <div class="bg-white rounded-lg shadow-lg p-6" 
                        :class="[
                            isMyTurn && !gameState.gameOver ? 
                            'ring-4 ring-blue-200 ring-offset-4 ring-offset-blue-50 animate-pulse-light' : ''
                        ]"
                    >
                        <div v-if="isMyTurn && !gameState.gameOver" class="mb-4">
                            <div class="text-center mb-4">
                                <p class="text-lg font-semibold" :class="{
                                    'text-red-600': timeLeft <= 5,
                                    'text-yellow-600': timeLeft <= 10 && timeLeft > 5,
                                    'text-blue-600': timeLeft > 10
                                }">
                                    Time Left: {{ timeLeft }}s
                                </p>
                                <div class="w-full bg-gray-200 rounded-full h-2.5">
                                    <div 
                                        class="h-2.5 rounded-full transition-all duration-200"
                                        :class="{
                                            'bg-red-600': timeLeft <= 5,
                                            'bg-yellow-600': timeLeft <= 10 && timeLeft > 5,
                                            'bg-blue-600': timeLeft > 10
                                        }"
                                        :style="{ width: `${(timeLeft / 20) * 100}%` }"
                                    ></div>
                                </div>
                            </div>

                            <input 
                                v-model="guess" 
                                maxlength="4" 
                                placeholder="Enter 4-digit guess"
                                pattern="[0-9]*"
                                inputmode="numeric"
                                class="w-full text-center text-2xl font-mono tracking-widest p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                            />
                            <p class="text-sm text-gray-500 mt-2 text-center">Enter 4 unique digits (0-9)</p>
                            <button 
                                @click="submitGuess"
                                :disabled="!isMyTurn || guess.length !== 4 || !/^\d{4}$/.test(guess)"
                                class="w-full mt-4 py-3 px-6 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                Submit Guess
                            </button>
                        </div>
                        <div v-else-if="!gameState.gameOver" class="text-center py-8">
                            <p class="text-xl text-gray-600">
                                Current Turn: {{ currentPlayerName }}
                            </p>
                        </div>
                        <div v-else class="text-center py-8">
                            <div v-if="winnerName" class="mb-4">
                                <p class="text-2xl font-bold text-green-600">🎉 Winner: {{ winnerName }}! 🎉</p>
                            </div>
                            <div v-else class="mb-4">
                                <p class="text-2xl font-bold text-red-600">Game Over!</p>
                                <p class="text-gray-600">No one guessed the code</p>
                            </div>
                            <div v-if="hasGuessed" class="mt-4 p-4 bg-gray-50 rounded-lg">
                                <p class="text-gray-700">The correct code was:</p>
                                <p class="font-mono font-bold text-3xl text-indigo-700 mt-2">{{ gameState.code }}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Guess History -->
                    <div class="bg-white rounded-lg shadow-lg p-6">
                        <h2 class="text-lg font-semibold mb-4">Your Guess History</h2>
                        <div class="overflow-hidden rounded-lg border border-gray-200">
                            <table class="w-full">
                                <thead>
                                    <tr class="bg-gray-50">
                                        <th class="px-4 py-3 text-left text-sm font-semibold text-gray-600">Guess</th>
                                        <th class="px-4 py-3 text-center text-sm font-semibold text-gray-600">Results</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(guess, index) in guessHistory" :key="index" 
                                        class="border-t border-gray-200">
                                        <td class="px-4 py-3">
                                            <span class="font-mono text-lg">{{ guess.guess || '-' }}</span>
                                        </td>
                                        <td class="px-4 py-3">
                                            <div class="flex justify-center gap-3">
                                                <span class="flex items-center">
                                                    <span class="w-3 h-3 rounded-full bg-green-500 mr-1"></span>
                                                    <span class="text-green-700">{{ guess.result?.correctPosition || 0 }}</span>
                                                </span>
                                                <span class="flex items-center">
                                                    <span class="w-3 h-3 rounded-full bg-yellow-500 mr-1"></span>
                                                    <span class="text-yellow-700">{{ guess.result?.correctNumber || 0 }}</span>
                                                </span>
                                                <span class="flex items-center">
                                                    <span class="w-3 h-3 rounded-full bg-red-500 mr-1"></span>
                                                    <span class="text-red-700">{{ guess.result?.wrong || 0 }}</span>
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr v-if="guessHistory.length === 0">
                                        <td colspan="2" class="px-4 py-8 text-center text-gray-500">
                                            No guesses yet
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div class="mt-4 grid grid-cols-3 gap-2 text-sm">
                            <div class="flex items-center">
                                <span class="w-3 h-3 rounded-full bg-green-500 mr-1"></span>
                                <span class="text-gray-600">Correct position</span>
                            </div>
                            <div class="flex items-center">
                                <span class="w-3 h-3 rounded-full bg-yellow-500 mr-1"></span>
                                <span class="text-gray-600">Correct number</span>
                            </div>
                            <div class="flex items-center">
                                <span class="w-3 h-3 rounded-full bg-red-500 mr-1"></span>
                                <span class="text-gray-600">Wrong</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Game Over Actions -->
                <div v-if="gameState.gameOver" class="mt-6 bg-white rounded-lg shadow-lg p-6">
                    <div class="flex justify-center gap-4">
                        <button 
                            v-if="isAdmin"
                            @click="retryGame"
                            class="py-3 px-6 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all"
                        >
                            Play Again
                        </button>
                        <button 
                            @click="handleExit"
                            class="py-3 px-6 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 focus:ring-4 focus:ring-gray-200 transition-all"
                        >
                            Exit Game
                        </button>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<style scoped>
.animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.5;
    }
}

/* Add these styles */
.group:hover .hidden {
    display: block;
}

/* Ensure tooltips stay within viewport on mobile */
@media (max-width: 640px) {
    .group:hover .absolute {
        left: auto;
        right: full;
        transform: translateX(-120%);
        margin-right: 0;
    }
}

/* Add smooth transitions */
.group-hover\:opacity-100 {
    transition: opacity 0.2s ease-in-out;
}

.opacity-0 {
    transition: opacity 0.2s ease-in-out;
}

.notification-enter-active,
.notification-leave-active {
    transition: all 0.3s ease;
}

.notification-enter-from {
    opacity: 0;
    transform: translateX(30px);
}

.notification-leave-to {
    opacity: 0;
    transform: translateY(-30px);
}

@keyframes pulse-light {
    0%, 100% {
        box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.2);
    }
    50% {
        box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
    }
}

.animate-pulse-light {
    animation: pulse-light 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>