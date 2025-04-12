<script>
    import { onMount, onDestroy } from 'svelte';

    let ws;
    let code = '';
    let status = 'initializing'; // 'initializing' | 'connected' | 'waiting' | 'success' | 'error'
    let error = '';

    function generateCode() {
        return Math.floor(100000 + Math.random() * 899999).toString();
    }

    function initializeWebSocket() {
        code = generateCode();
        status = 'initializing';
        
        ws = new WebSocket('wss://rakathon-proxy.manakjiri.cz/doctor');

        ws.onopen = () => {
            status = 'connected';
            // Send initial message
            ws.send(JSON.stringify({
                message_type: 'doctor_session_init',
                code: code
            }));
            status = 'waiting';
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.message_type === 'doctor_session_patient_connected') {
                // Send dummy response
                ws.send(JSON.stringify({
                    message_type: 'doctor_session_response',
                    data: {
                        dummy: 'data',
                        timestamp: new Date().toISOString()
                    }
                }));
                // Close the connection ourselves
                ws.close();
                status = 'success';
            }
        };

        ws.onclose = () => {
            status = 'success';
            console.log('WebSocket connection closed');
        };

        ws.onerror = (event) => {
            status = 'error';
            error = 'WebSocket connection failed';
            console.error('WebSocket error:', event);
        };
    }

    onMount(() => {
        initializeWebSocket();
    });

    onDestroy(() => {
        if (ws) {
            ws.close();
        }
    });
</script>

<div class="container">
    {#if status === 'initializing'}
        <div class="status">Initializing connection...</div>
    {:else if status === 'connected'}
        <div class="status">Connected, preparing session...</div>
    {:else if status === 'waiting'}
        <div class="code">{code}</div>
        <div class="status">Waiting for patient connection...</div>
    {:else if status === 'success'}
        <div class="success">Session completed successfully!</div>
    {:else if status === 'error'}
        <div class="error">
            {error}
            <button on:click={initializeWebSocket}>Retry</button>
        </div>
    {/if}
</div>

<style>
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 1rem;
    }

    .code {
        font-size: 4rem;
        font-weight: bold;
        margin: 2rem 0;
        letter-spacing: 0.5rem;
    }

    .status {
        font-size: 1.2rem;
        color: #666;
    }

    .success {
        color: #2ecc71;
        font-size: 1.5rem;
    }

    .error {
        color: #e74c3c;
        text-align: center;
    }

    button {
        margin-top: 1rem;
        padding: 0.5rem 1rem;
        background-color: #3498db;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    button:hover {
        background-color: #2980b9;
    }
</style>