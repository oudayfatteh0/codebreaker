<script>
import { ref } from 'vue';
import { mapActions, mapState } from 'vuex';
import GameBoard from './components/GameBoard.vue';
import RoomSelection from './components/RoomSelection.vue';

export default {
    components: {
        GameBoard,
        RoomSelection
    },
    computed: {
        ...mapState({
            roomCode: state => state.roomCode
        })
    },
    setup() {
        const currentView = ref('room-selection');
        
        const setView = (view) => {
            currentView.value = view;
        };

        return {
            currentView,
            setView
        };
    },
    methods: {
        ...mapActions(['connect'])
    },
    watch: {
        roomCode: {
            handler(newVal) {
                if (newVal) {
                    this.currentView = 'game-board';
                } else {
                    this.currentView = 'room-selection';
                }
            },
            immediate: true
        }
    },
    mounted() {
        this.connect();
    }
};
</script>

<template>
    <RoomSelection 
        v-if="currentView === 'room-selection'" 
        @room-joined="setView('game-board')"
    />
    <GameBoard 
        v-else 
        @exit="setView('room-selection')"
    />
</template>
