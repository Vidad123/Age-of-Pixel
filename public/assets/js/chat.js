document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireSession(); if (!user) return;
  const friendId = Number(new URLSearchParams(location.search).get('friend'));
  const list = document.querySelector('#chatMessages'), status = document.querySelector('#chatStatus'), input = document.querySelector('#chatInput');
  let lastMarkup = '';
  const show = (text,error=false) => { status.textContent=text||''; status.classList.toggle('error',error); };
  async function load() {
    try {
      const data=await apiGet(`api/chat.php?friend=${friendId}`); if(!data.ok) throw new Error((data.errors||['Chat unavailable.'])[0]);
      document.querySelector('#chatName').textContent=data.friend.display_name||data.friend.username; document.querySelector('#chatUsername').textContent=`@${data.friend.username}`;
      const avatar=document.querySelector('#chatAvatar'); avatar.textContent=((data.friend.display_name||data.friend.username||'?')[0]).toUpperCase(); avatar.style.background=data.friend.avatar_color||'#9b672e';
      const markup=data.messages.length ? data.messages.map(message=>`<article class="chat-bubble ${message.sender_id===data.me?'mine':'theirs'}"><span>${escapeHtml(message.message)}</span><small>${escapeHtml(message.created_at)}</small></article>`).join('') : '<p class="chat-empty">No messages yet. Say hello!</p>';
      if(markup!==lastMarkup){list.innerHTML=markup;list.scrollTop=list.scrollHeight;lastMarkup=markup;}
      show('');
    } catch(error){show(error.message,true);}
  }
  document.querySelector('#chatForm').addEventListener('submit',async event=>{event.preventDefault();const message=input.value.trim();if(!message)return;input.disabled=true;try{const data=await apiPost('api/chat.php',{friend_id:friendId,message});if(!data.ok)throw new Error((data.errors||['Could not send message.'])[0]);input.value='';await load();}catch(error){show(error.message,true);}finally{input.disabled=false;input.focus();}});
  await load(); window.setInterval(load,3000); document.body.classList.add('auth-ready');
});
