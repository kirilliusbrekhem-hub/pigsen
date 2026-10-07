"use client";
import Script from "next/script";
import { useEffect } from "react";
import { reachGoal } from "@/lib/analytics/goal";
import { GOAL_COOKIE, UTM_COOKIE, VID_COOKIE } from "@/lib/analytics/utm";

const YM_ID = process.env.NEXT_PUBLIC_YM_ID ?? "";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";
const gaOk = /^G-[A-Z0-9]{4,20}$/.test(GA_ID);
const ymOk = /^\d+$/.test(YM_ID);

function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}
function setCookie(name: string, value: string, days: number) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Max-Age=${days * 86400}; Path=/; SameSite=Lax${secure}`;
}
function randomId() {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }
}

function capture() {
  const q = new URLSearchParams(location.search);
  const pick = (k: string, n: number) => (q.get(k) ?? "").slice(0, n);
  let referrer = "";
  try {
    if (document.referrer && new URL(document.referrer).host !== location.host) referrer = document.referrer.slice(0, 200);
  } catch {
    /* ignore */
  }
  let utmRaw = getCookie(UTM_COOKIE);
  if (!utmRaw) {
    const utm = { source: pick("utm_source", 64), medium: pick("utm_medium", 64), campaign: pick("utm_campaign", 100), content: pick("utm_content", 100), landing: location.pathname.slice(0, 120), referrer };
    let enc = encodeURIComponent(JSON.stringify(utm));
    while (enc.length > 500 && utm.referrer) {
      utm.referrer = utm.referrer.slice(0, Math.max(0, utm.referrer.length - 40));
      enc = encodeURIComponent(JSON.stringify(utm));
    }
    if (enc.length <= 500) setCookie(UTM_COOKIE, enc, 30);
    utmRaw = enc;
  }
  let vid = getCookie(VID_COOKIE);
  if (!vid || !/^[A-Za-z0-9_-]{8,64}$/.test(vid)) {
    vid = randomId();
    setCookie(VID_COOKIE, vid, 365);
  }
  const day = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem("pigsen_visit_day") === day) return;
    localStorage.setItem("pigsen_visit_day", day);
  } catch {
    /* storage blocked: the server dedupes by (visitor, day) anyway */
  }
  let utm: { source?: string; campaign?: string } = {};
  try {
    utm = JSON.parse(decodeURIComponent(utmRaw));
  } catch {
    /* ignore */
  }
  fetch("/api/visit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId: vid, path: location.pathname.slice(0, 200), source: utm.source ?? "", campaign: utm.campaign ?? "" }),
    keepalive: true,
  }).catch(() => {});
}

export function Analytics() {
  useEffect(() => {
    try {
      capture();
    } catch {
      /* analytics must never break the page */
    }
    // "register" goal: the register API sets a short-lived flag cookie; fire once the counter is loaded.
    if (getCookie(GOAL_COOKIE) === "register") {
      setCookie(GOAL_COOKIE, "", 0);
      let tries = 0;
      const t = setInterval(() => {
        tries++;
        if (typeof (window as unknown as { ym?: unknown }).ym === "function" || typeof (window as unknown as { gtag?: unknown }).gtag === "function" || tries > 20) {
          clearInterval(t);
          reachGoal("register");
        }
      }, 500);
      return () => clearInterval(t);
    }
  }, []);

  return (
    <>
      {gaOk && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      )}
      {ymOk && <YandexMetrica />}
    </>
  );
}

function YandexMetrica() {
  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">
        {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${YM_ID},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});`}
      </Script>
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://mc.yandex.ru/watch/${YM_ID}`} style={{ position: "absolute", left: -9999 }} alt="" />
        </div>
      </noscript>
    </>
  );
}
