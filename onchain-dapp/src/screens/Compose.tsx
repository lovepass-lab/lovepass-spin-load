import React, { useState } from 'react';

export default function Compose() {
  const [toEns, setToEns] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  return (
    <section>
      <h2>Compose</h2>
      <input placeholder="to ENS (e.g. vaped.eth)" value={toEns} onChange={e=>setToEns(e.target.value)} />
      <input placeholder="Subject" value={subject} onChange={e=>setSubject(e.target.value)} />
      <textarea placeholder="Message" value={text} onChange={e=>setText(e.target.value)} />
      <button>Send</button>
    </section>
  );
}
