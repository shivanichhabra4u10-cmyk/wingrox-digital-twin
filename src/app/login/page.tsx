import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInAction, signUpAction } from "@/app/login/actions";
import { USER_ROLES } from "@/lib/auth/types";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const env = getPublicSupabaseEnv();

  if (!env.isConfigured) {
    redirect("/setup");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const params = await searchParams;
  const error = params.error;

  if (user) {
    redirect("/app");
  }

  const serif = '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,"Times New Roman",serif';
  const ink   = "#0C1A2B";
  const brass = "#A67C34";
  const slate = "#5A6A7D";

  const circles = Array.from({length: 14}, (_, i) => (
    <circle key={i} cx="470" cy="392" r={70 + i * 46} />
  ));

  return (
    <main style={{minHeight:"100vh", display:"grid", gridTemplateColumns:"minmax(0,1.05fr) minmax(0,1fr)"}}>

      {/* ── Left: dark cover ── */}
      <aside style={{position:"relative", background:ink, color:"#fff", overflow:"hidden", display:"flex"}}>
        {/* engraved circle pattern */}
        <svg viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
          style={{position:"absolute",inset:0,width:"100%",height:"100%",fill:"none",stroke:"rgba(166,124,52,0.22)",strokeWidth:1}}>
          {circles}
        </svg>

        <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"48px 56px",width:"100%"}}>
          {/* Logo */}
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="4" fill={brass}/>
              <path d="M7 10l4 12 5-9 5 9 4-12" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <div style={{fontFamily:serif,fontSize:"1.22rem",fontWeight:600,letterSpacing:"0.01em"}}>WinGroX</div>
              <div style={{fontSize:"0.6rem",letterSpacing:"0.19em",textTransform:"uppercase",color:"rgba(255,255,255,0.5)",marginTop:1}}>Individual Growth Intelligence</div>
            </div>
          </div>

          {/* Hero copy */}
          <div style={{maxWidth:"34ch"}}>
            <p style={{fontFamily:serif,fontSize:"clamp(1.9rem,3.4vw,2.7rem)",lineHeight:1.16,fontWeight:600,letterSpacing:"-0.015em",margin:0,color:"#fff"}}>
              From self&#8209;awareness<br/>to self&#8209;authorship.
            </p>
            <span style={{display:"block",width:52,height:2,background:brass,margin:"22px 0"}}/>
            <p style={{fontSize:"0.92rem",lineHeight:1.65,color:"rgba(255,255,255,0.66)",margin:0}}>
              Seven steps, twelve weeks, and one working view of a career that keeps changing as the evidence arrives. Everything recorded here belongs to the person it describes.
            </p>
          </div>

          {/* Footer */}
          <footer style={{display:"flex",gap:26,fontSize:"0.63rem",letterSpacing:"0.17em",textTransform:"uppercase",color:"rgba(255,255,255,0.36)",borderTop:"1px solid rgba(255,255,255,0.10)",paddingTop:16}}>
            <span>Confidential</span><span>Secure Workspace</span><span>{new Date().getFullYear()}</span>
          </footer>
        </div>
      </aside>

      {/* ── Right: form panel ── */}
      <main style={{display:"grid",placeItems:"center",padding:"40px 56px",background:"#FFFFFF"}}>
        <div style={{width:"100%",maxWidth:378}}>
          <div style={{fontSize:"0.68rem",letterSpacing:"0.15em",textTransform:"uppercase",color:brass,fontWeight:700,marginBottom:10}}>Programme access</div>
          <h1 style={{fontFamily:serif,fontSize:"2.05rem",fontWeight:600,margin:"0 0 6px",color:ink}}>Sign in</h1>
          <p style={{color:slate,fontSize:"0.9rem",margin:"0 0 26px"}}>Your username or email and password decide which screen opens.</p>

          {error && (
            <div style={{display:"flex",gap:9,alignItems:"flex-start",background:"#FAF0F0",borderLeft:`2px solid #C0392B`,borderRadius:"0 4px 4px 0",padding:"10px 13px",fontSize:"0.87rem",color:"#7C2C2B",marginBottom:18}}>
              {error}
            </div>
          )}

          <form action={signInAction}>
            <div style={{marginBottom:15}}>
              <label style={{display:"block",fontSize:"0.68rem",letterSpacing:"0.15em",textTransform:"uppercase",color:slate,marginBottom:7,fontWeight:700}}>Username or email</label>
              <input name="identifier" type="text" required placeholder="e.g. dipti or dipti@example.com" autoComplete="username"
                style={{width:"100%",fontSize:"0.98rem",padding:"11px 2px",border:0,borderBottom:`1px solid #D1D9E0`,borderRadius:0,background:"transparent",outline:"none",color:ink}}
              />
            </div>
            <div style={{marginBottom:15}}>
              <label style={{display:"block",fontSize:"0.68rem",letterSpacing:"0.15em",textTransform:"uppercase",color:slate,marginBottom:7,fontWeight:700}}>Password</label>
              <input name="password" type="password" required minLength={8} placeholder="Enter your password" autoComplete="current-password"
                style={{width:"100%",fontSize:"0.98rem",padding:"11px 2px",border:0,borderBottom:`1px solid #D1D9E0`,borderRadius:0,background:"transparent",outline:"none",color:ink}}
              />
            </div>
            <button type="submit"
              style={{width:"100%",marginTop:12,fontWeight:600,fontSize:"0.94rem",cursor:"pointer",background:ink,color:"#fff",border:`1px solid ${ink}`,borderRadius:4,padding:"13px 18px",display:"flex",alignItems:"center",justifyContent:"center",gap:9}}>
              Sign in →
            </button>
          </form>

          <details style={{marginTop:26,borderTop:"1px solid #E4EAF0",paddingTop:16}}>
            <summary style={{cursor:"pointer",listStyle:"none",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:"0.72rem",letterSpacing:"0.14em",textTransform:"uppercase",color:slate,fontWeight:700}}>
              <span>Create account</span>
            </summary>
            <form action={signUpAction} style={{marginTop:16}}>
              <div style={{marginBottom:12}}>
                <label style={{display:"block",fontSize:"0.68rem",letterSpacing:"0.15em",textTransform:"uppercase",color:slate,marginBottom:6,fontWeight:700}}>Full name</label>
                <input name="fullName" type="text" required minLength={2} placeholder="Your full name"
                  style={{width:"100%",fontSize:"0.95rem",padding:"9px 2px",border:0,borderBottom:`1px solid #D1D9E0`,borderRadius:0,background:"transparent",outline:"none",color:ink}}/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{display:"block",fontSize:"0.68rem",letterSpacing:"0.15em",textTransform:"uppercase",color:slate,marginBottom:6,fontWeight:700}}>Email</label>
                <input name="email" type="email" required placeholder="you@example.com"
                  style={{width:"100%",fontSize:"0.95rem",padding:"9px 2px",border:0,borderBottom:`1px solid #D1D9E0`,borderRadius:0,background:"transparent",outline:"none",color:ink}}/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{display:"block",fontSize:"0.68rem",letterSpacing:"0.15em",textTransform:"uppercase",color:slate,marginBottom:6,fontWeight:700}}>Password</label>
                <input name="password" type="password" required minLength={8} placeholder="Min 8 characters"
                  style={{width:"100%",fontSize:"0.95rem",padding:"9px 2px",border:0,borderBottom:`1px solid #D1D9E0`,borderRadius:0,background:"transparent",outline:"none",color:ink}}/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{display:"block",fontSize:"0.68rem",letterSpacing:"0.15em",textTransform:"uppercase",color:slate,marginBottom:6,fontWeight:700}}>Role</label>
                <select name="role" required style={{width:"100%",fontSize:"0.95rem",padding:"9px 2px",border:0,borderBottom:`1px solid #D1D9E0`,borderRadius:0,background:"transparent",outline:"none",color:ink}}>
                  {USER_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <button type="submit" style={{width:"100%",marginTop:8,fontWeight:600,fontSize:"0.92rem",cursor:"pointer",background:"transparent",color:ink,border:`1px solid ${ink}`,borderRadius:4,padding:"11px 18px"}}>
                Create account
              </button>
            </form>
          </details>

          <p style={{marginTop:22,fontSize:"0.76rem",lineHeight:1.6,color:slate,borderLeft:`2px solid #E4EAF0`,paddingLeft:12}}>
            <strong style={{color:ink}}>Important.</strong> Use assigned credentials only and share account details through approved secure channels.
          </p>
          <p style={{marginTop:10,fontSize:"0.76rem",lineHeight:1.6,color:slate}}>
            Demo usernames supported here: dipti, architect, coach, sponsor.
          </p>
        </div>
      </main>

    </main>
  );
}


