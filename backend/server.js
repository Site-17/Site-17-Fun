import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-change-me-site17-2026';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '5m';

app.use(cors());
app.use(express.json({ limit: '1mb' }));
// serve frontend static if you copy index.html into backend/public
app.use(express.static(path.join(__dirname, '../')));

// --- helpers: JSON persistence — server-side, not per-browser ---
// Free persistence without paid DB: local JSON files (survives on VPS / Fly volume)
// + optional free GitHub sync (survives ephemeral Render) — needs GITHUB_TOKEN + GITHUB_REPO in env, NOT in source
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const GH_REPO = process.env.GITHUB_REPO || ''; // e.g. Site-17/Site-17-Fun
const GH_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GH_TOKEN = process.env.GITHUB_TOKEN || '';
const GH_PATH_PREFIX = 'backend/data/';

async function ghSave(name, val){
  if(!GH_TOKEN || !GH_REPO) return;
  try{
    const content = Buffer.from(JSON.stringify(val,null,2)).toString('base64');
    const api = `https://api.github.com/repos/${GH_REPO}/contents/${GH_PATH_PREFIX}${name}`;
    // get current sha if exists
    let sha = undefined;
    try{
      const r = await fetch(`${api}?ref=${GH_BRANCH}`, {headers:{Authorization:`Bearer ${GH_TOKEN}`, Accept:'application/vnd.github+json'}});
      if(r.ok){ const j=await r.json(); sha=j.sha; }
    }catch{}
    const put = await fetch(api, {
      method:'PUT',
      headers:{Authorization:`Bearer ${GH_TOKEN}`, Accept:'application/vnd.github+json', 'Content-Type':'application/json'},
      body: JSON.stringify({message:`chore: persist ${name}`, content, sha, branch:GH_BRANCH})
    });
    if(!put.ok) console.warn('ghSave', name, await put.text().then(t=>t.slice(0,200)));
    else console.log(`Persisted ${name} to GitHub ${GH_REPO}`);
  }catch(e){ console.warn('ghSave failed', name, e.message); }
}

async function ghLoad(name){
  if(!GH_TOKEN || !GH_REPO) return null;
  try{
    const api = `https://api.github.com/repos/${GH_REPO}/contents/${GH_PATH_PREFIX}${name}?ref=${GH_BRANCH}`;
    const r = await fetch(api, {headers:{Authorization:`Bearer ${GH_TOKEN}`, Accept:'application/vnd.github+json'}});
    if(!r.ok) return null;
    const j=await r.json();
    const dec = Buffer.from(j.content, 'base64').toString('utf8');
    return JSON.parse(dec);
  }catch(e){ console.warn('ghLoad', name, e.message); return null; }
}

function loadJSON(name, fallback){
  const p = path.join(dataDir, name);
  try{
    if(fs.existsSync(p)) return JSON.parse(fs.readFileSync(p,'utf8'));
  }catch(e){ console.warn('load', name, e.message); }
  return fallback;
}
function saveJSON(name, val){
  const p = path.join(dataDir, name);
  try{ fs.writeFileSync(p, JSON.stringify(val,null,2)); }catch(e){ console.warn('save', name, e.message); }
  // fire-and-forget GitHub sync — free, no paid DB, safe (token in env, not source)
  ghSave(name, val).catch(()=>{});
}
// on boot, if local file missing but GitHub has it, restore — makes deploys on ephemeral Render still persistent for free
async function hydrateFromGitHub(){
  for(const n of ['users.json','scps.json','chat.json']){
    const p = path.join(dataDir, n);
    if(!fs.existsSync(p)){
      const g = await ghLoad(n);
      if(g){ try{ fs.writeFileSync(p, JSON.stringify(g,null,2)); console.log(`Restored ${n} from GitHub`); }catch{} }
    }
  }
}

// --- defaults ---
let users = loadJSON('users.json', null);
if(!users){
  const hash = (s)=> bcrypt.hashSync(s, 10);
  users = [
    { username:'director', passwordHash: hash('Keter-7-Blackbox'), role:'director', clearance:'Level 5', rank:'director_rank', title:'Site Director', created:Date.now()-86400000*30, status:'active' },
    { username:'agent_moore', passwordHash: hash('Euclid-3-Frost'), role:'personnel', clearance:'Level 3', rank:'agent', title:'Field Agent', created:Date.now()-86400000*5, status:'active' },
    { username:'dr_cleff', passwordHash: hash('Safe-9-Gamma'), role:'researcher', clearance:'Level 4', rank:'senior', title:'Senior Researcher', created:Date.now()-86400000*10, status:'active' },
    { username:'agent_zhang', passwordHash: hash('Keter-2-Red'), role:'security', clearance:'Level 2', rank:'officer', title:'Security Officer', created:Date.now()-86400000*2, status:'active' },
  ];
  saveJSON('users.json', users);
}
let scps = loadJSON('scps.json', null);
if(!scps){
  scps = [
    { id:'1', number:'SCP-173', title:'The Sculpture', class:'Euclid', image:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', containment:'Keep in locked container. Maintain eye contact. 3 personnel enter, 2 watch.', description:'Concrete rebar statue, animates when unobserved. Extremely hostile.', addendum:'Audio logs show movement even when observed via delay.', updated:Date.now()-1e6 },
    { id:'2', number:'SCP-096', title:'The Shy Guy', class:'Euclid', image:'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80', containment:'No viewing of image. 5m steel cube, indirect monitoring only.', description:'2.38m humanoid. Docile until its image is seen, then hunts viewer relentlessly.', addendum:'Ocean floor traversal at 35 km/h.', updated:Date.now()-2e6 },
    { id:'5', number:'SCP-999', title:'The Tickle Monster', class:'Safe', image:'https://images.unsplash.com/photo-1518531938570-fa1891388d3d?w=600&q=80', containment:'Free roam in Safe wing, supervised.', description:'Orange slime, induces euphoria and happiness. Docile.', addendum:'Recommended for morale.', updated:Date.now()-5e5 },
  ];
  saveJSON('scps.json', scps);
}
let chats = loadJSON('chat.json', { staff: [] });
if(!chats.staff) chats.staff=[];

// --- auth middleware ---
function auth(req,res,next){
  const h=req.headers.authorization||'';
  const token=h.startsWith('Bearer ')? h.slice(7): null;
  if(!token) return res.status(401).json({error:'Missing token'});
  try{
    const payload=jwt.verify(token, JWT_SECRET);
    const u=users.find(x=>x.username===payload.username);
    if(!u || u.status==='banned') return res.status(401).json({error:'User not found or banned'});
    req.user=u;
    next();
  }catch(e){
    return res.status(401).json({error:'Invalid or expired token'});
  }
}
function director(req,res,next){
  if(req.user.role!=='director') return res.status(403).json({error:'Director only'});
  next();
}

// --- routes ---
app.get('/health', (req,res)=> res.json({ok:true, users:users.length, scps:scps.length}));

app.post('/api/login', async (req,res)=>{
  const {username, password} = req.body||{};
  if(!username || !password) return res.status(400).json({error:'Missing credentials'});
  const u=users.find(x=>x.username.toLowerCase()===String(username).toLowerCase());
  if(!u) return res.status(401).json({error:'Invalid credentials'});
  if(u.status==='banned') return res.status(403).json({error:'Operative banned'});
  const ok=await bcrypt.compare(String(password), u.passwordHash);
  if(!ok) return res.status(401).json({error:'Invalid credentials'});
  const token=jwt.sign({username:u.username, role:u.role}, JWT_SECRET, {expiresIn: JWT_EXPIRES});
  const {passwordHash:_, ...safeUser}=u;
  res.json({token, user:safeUser});
});

app.get('/api/scp', auth, (req,res)=> res.json(scps));
app.post('/api/scp', auth, director, (req,res)=>{
  const {number, title, class:cls, image, containment, description, addendum} = req.body||{};
  if(!number || !title || !cls || !containment || !description) return res.status(400).json({error:'Missing fields'});
  if(!/^SCP-\d{3,4}$/i.test(number)) return res.status(400).json({error:'Number must be SCP-XXX'});
  if(scps.some(s=>s.number.toLowerCase()===number.toLowerCase())) return res.status(409).json({error:'Number already exists'});
  const obj={ id:Date.now().toString(36), number:number.toUpperCase(), class:cls, title:String(title).slice(0,120), image:String(image||''), containment:String(containment).slice(0,2000), description:String(description).slice(0,2000), addendum:String(addendum||'').slice(0,2000), updated:Date.now() };
  scps.unshift(obj); saveJSON('scps.json', scps);
  res.status(201).json(obj);
});
app.put('/api/scp/:id', auth, director, (req,res)=>{
  const it=scps.find(s=>s.id===req.params.id);
  if(!it) return res.status(404).json({error:'Not found'});
  Object.assign(it, {
    number: req.body.number ? String(req.body.number).toUpperCase() : it.number,
    class: req.body.class || it.class,
    title: req.body.title ? String(req.body.title).slice(0,120) : it.title,
    image: req.body.image!==undefined ? String(req.body.image) : it.image,
    containment: req.body.containment ? String(req.body.containment).slice(0,2000) : it.containment,
    description: req.body.description ? String(req.body.description).slice(0,2000) : it.description,
    addendum: req.body.addendum!==undefined ? String(req.body.addendum).slice(0,2000) : it.addendum,
    updated: Date.now()
  });
  saveJSON('scps.json', scps);
  res.json(it);
});
app.delete('/api/scp/:id', auth, director, (req,res)=>{
  const before=scps.length;
  scps=scps.filter(s=>s.id!==req.params.id);
  if(scps.length===before) return res.status(404).json({error:'Not found'});
  saveJSON('scps.json', scps);
  res.json({ok:true});
});

app.get('/api/users', auth, director, (req,res)=>{
  const safe=users.map(({passwordHash:_,...u})=>u);
  res.json(safe);
});
app.post('/api/users', auth, director, async (req,res)=>{
  const {username, password, role, clearance, rank} = req.body||{};
  if(!username || !password || !role || !clearance) return res.status(400).json({error:'Missing fields'});
  if(!/^[a-zA-Z0-9_\-]{3,24}$/.test(username)) return res.status(400).json({error:'Username 3-24 a-z0-9 _-'});
  if(users.some(u=>u.username.toLowerCase()===String(username).toLowerCase())) return res.status(409).json({error:'Username exists'});
  if(String(password).length<8) return res.status(400).json({error:'Password min 8 chars'});
  const hash=await bcrypt.hash(String(password), 10);
  const titleMap={personnel:'Personnel',researcher:'Researcher',security:'Security Officer',medical:'Medical Officer',field:'Field Agent',containment:'Containment Specialist',engineer:'Site Engineer',technician:'Technician',archivist:'Archivist',mtf:'MTF Commander',ethics:'Ethics Committee',o5:'O5 Council',admin:'Administrator',dclass:'D-Class Personnel',director:'Site Director'};
  const obj={ username:String(username), passwordHash:hash, role:String(role), clearance:String(clearance), rank:String(rank||'recruit'), title:titleMap[role]||'Personnel', created:Date.now(), status:'active' };
  users.push(obj); saveJSON('users.json', users);
  const {passwordHash:_,...safe}=obj;
  res.status(201).json(safe);
});
app.post('/api/users/:username/ban', auth, director, (req,res)=>{
  const u=users.find(x=>x.username===req.params.username);
  if(!u) return res.status(404).json({error:'Not found'});
  u.status = u.status==='banned' ? 'active' : 'banned';
  saveJSON('users.json', users);
  const {passwordHash:_,...safe}=u;
  res.json(safe);
});
app.delete('/api/users/:username', auth, director, (req,res)=>{
  const idx=users.findIndex(x=>x.username===req.params.username);
  if(idx===-1) return res.status(404).json({error:'Not found'});
  if(users[idx].username==='director') return res.status(403).json({error:'Cannot remove director'});
  users.splice(idx,1); saveJSON('users.json', users);
  res.json({ok:true});
});

app.get('/api/chat', auth, (req,res)=> res.json(chats.staff.slice(-200)));
app.post('/api/chat', auth, (req,res)=>{
  const text=String(req.body?.text||'').trim().slice(0,500);
  if(!text) return res.status(400).json({error:'Empty'});
  if(!chats.staff) chats.staff=[];
  chats.staff.push({user:req.user.username, text, time:Date.now()});
  if(chats.staff.length>200) chats.staff=chats.staff.slice(-200);
  saveJSON('chat.json', chats);
  res.status(201).json({ok:true});
});
app.delete('/api/chat', auth, director, (req,res)=>{
  chats.staff=[{user:'SYSTEM', text:'Chat cleared by '+req.user.username, time:Date.now(), sys:true}];
  saveJSON('chat.json', chats);
  res.json({ok:true});
});

// hydrate from GitHub (free, no paid DB) before listening — ensures data survives ephemeral restarts
hydrateFromGitHub().finally(()=>{
  // reload in-memory after restore (so first request sees GitHub data, not defaults)
  try{
    const u = loadJSON('users.json', null); if(u) users = u;
    const s = loadJSON('scps.json', null); if(s) scps = s;
    const c = loadJSON('chat.json', null); if(c) chats = c;
  }catch{}
  if(!process.env.JWT_SECRET || process.env.JWT_SECRET==='dev-change-me-site17-2026'){
    console.warn('⚠ JWT_SECRET is default — set a strong random value in .env (safe even with source revealed, secret is in env, not code)');
  }
  app.listen(PORT, ()=> console.log(`Site-17 backend listening on http://localhost:${PORT} — persistence: local JSON${GH_TOKEN?' + GitHub '+GH_REPO:''}`));
});
