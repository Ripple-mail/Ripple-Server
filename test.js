async function main() {
    const response = await fetch('http://localhost:3001/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Angus Browning', email: 'test2~ripple.com', password: 'hehehaha' })
    });

    const data = await response.json();
    console.log(data);
}

main();