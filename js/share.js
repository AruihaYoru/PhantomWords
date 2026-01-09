export function addShareButton(cardElement, word, definition, translatedDef) {
    const header = cardElement.querySelector('.word-header');
    if (!header) return;

    const button = document.createElement('button');
    button.className = 'share-button';
    button.title = 'Share this word';
    button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px">
            <path d="M680-80q-50 0-85-35t-35-85q0-6 3-28L282-392q-16 15-37 23.5t-45 8.5q-50 0-85-35t-35-85q0-50 35-85t85-35q24 0 45 8.5t37 23.5l281-164q-2-7-2.5-13.5T560-760q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-24 0-45-8.5T598-672L317-508q2 7 2.5 13.5t.5 14.5q0 8-.5 14.5T317-452l281 164q16-15 37-23.5t45-8.5q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T720-200q0-17-11.5-28.5T680-240q-17 0-28.5 11.5T640-200q0 17 11.5 28.5T680-160ZM200-440q17 0 28.5-11.5T240-480q0-17-11.5-28.5T200-520q-17 0-28.5 11.5T160-480q0 17 11.5 28.5T200-440Zm480-280q17 0 28.5-11.5T720-760q0-17-11.5-28.5T680-800q-17 0-28.5 11.5T640-760q0 17 11.5 28.5T680-720Zm0 520ZM200-480Zm480-280Z"/>
        </svg>
    `;

    const baseUrl = 'https://phantomwords-ogp-server.vercel.app/share';
    const params = new URLSearchParams({
        word: word,
        define: translatedDef,
        english: definition
    });
    
    const shareUrl = `${baseUrl}?${params.toString()}`;
    const shareText = `PhantomWord: "${word}"\n\n${translatedDef}\n\n#PhantomWords`;
    
    button.addEventListener('click', async (e) => {
        e.stopPropagation();

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `PhantomWord: ${word}`,
                    text: shareText,
                    url: shareUrl,
                });
            } catch (err) {
                if (err.name !== 'AbortError') console.error('Error using Web Share API:', err);
            }
        } else {
            await copyToClipboard(button, shareUrl);
        }
    });

    header.appendChild(button);
}

async function copyToClipboard(button, text) {
    try {
        await navigator.clipboard.writeText(text);
        showFeedback(button, 'Share link copied!');
    } catch (err) {
        console.error('Failed to copy text:', err);
        showFeedback(button, 'Copy failed!');
    }
}

function showFeedback(element, message) {
    const existingFeedback = element.querySelector('.share-feedback');
    if (existingFeedback) existingFeedback.remove();

    const feedback = document.createElement('span');
    feedback.className = 'share-feedback';
    feedback.textContent = message;
    element.appendChild(feedback);

    setTimeout(() => {
        feedback.remove();
    }, 2000);
}

// -------------------------------------------------------------------------------

/* ちょーちょーちょーじゅうよう！！！

cd "C:\Users\Mecat\Documents\github\PhantomWords"
git add .
git commit -m "ここに詳細を入力"
git push

*/

// -------------------------------------------------------------------------------


