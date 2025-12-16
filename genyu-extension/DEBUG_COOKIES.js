// Debug script - paste vào Extension console để xem tất cả cookies

chrome.cookies.getAll({ domain: 'labs.google' }, (cookies) => {
    console.log('=== ALL COOKIES FROM labs.google ===');
    cookies.forEach(c => {
        console.log(`Name: ${c.name}`);
        console.log(`Value: ${c.value.substring(0, 50)}...`);
        console.log(`---`);
    });
});
