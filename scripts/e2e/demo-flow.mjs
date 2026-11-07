import { openPage } from './cdp.mjs';
const S = process.argv[2] ?? '/tmp';
const step = async (name, fn) => {
  process.stdout.write(`▶ ${name} ... `);
  try { await fn(); console.log('ok'); }
  catch (e) { console.log('FAIL\n' + e.message); await A.screenshot(`${S}/fail-A.png`); if (B) await B.screenshot(`${S}/fail-B.png`); process.exit(1); }
};
let B;
const A = await openPage(9401, 'http://localhost:8081');
await A.waitText('Join Red Phone|All clear|Possible attack|Enter your PIN', 20000);

await step('A: create first admin', async () => {
  await A.waitText('Create admin'); await A.sleep(500);
  const n0 = await A.evalJs(`[...document.querySelectorAll('input,textarea')].filter(e=>e.offsetParent!==null).length`);
  await A.type('Avery Admin', n0 - 1);
  await A.click('Create admin');
  await A.waitText('fingerprint|PIN');
});
await step('A: set PIN', async () => {
  await A.pin('123456'); await A.sleep(800); await A.pin('123456');
  await A.waitText('All clear|Possible attack', 15000);
});
let code;
await step('A: create Lead invite', async () => {
  await A.click('Team');
  await A.waitText('Invite someone');
  await A.click('Invite someone');
  await A.waitText('Incident Lead');
  await A.click('Incident Lead');
  const inputs = await A.evalJs(`[...document.querySelectorAll('input,textarea')].filter(e=>e.offsetParent!==null).length`);
  await A.type('Lee Lead', inputs - 1);
  await A.click('Show QR');
  await A.waitText('[0-9a-f]{64}');
  code = (await A.text()).match(/[0-9a-f]{64}/)[0];
});
B = await openPage(9402, 'http://localhost:8081');
await step('B: join with invite code', async () => {
  await B.waitText('Join Red Phone', 20000);
  await B.type('redphone:' + code, 0);
  await B.click('Join');
  await B.waitText('fingerprint|PIN', 15000);
  await B.pin('654321'); await B.sleep(800); await B.pin('654321');
  await B.waitText('All clear|Possible attack', 15000);
});
await step('A: invite shows Joined', async () => { await A.waitText('Joined'); });
await step('A: raise Possible attack', async () => {
  await A.click('Done').catch(() => {});
  await A.click('Home');
  await A.click('Possible attack');
  await A.waitText('Waiting for a Lead');
});
await step('B (Lead): confirm attack → alarm on both', async () => {
  await B.waitText('Confirm attack');
  await B.click('Confirm attack');
  await B.waitText('ATTACK CONFIRMED');
  await A.waitText('ATTACK CONFIRMED');
  await A.screenshot(`${S}/alarm-A.png`);
  await A.click("I'm here");
  await B.click("I'm here");
});
await step('B: pick Ransomware', async () => {
  await B.waitText('Ransomware');
  await B.click('Ransomware');
  await B.waitText('ransomware');
});
await step('B: tasks next step accept+done', async () => {
  await B.click('Tasks');
  await B.waitText('Your next step');
  await B.screenshot(`${S}/tasks-B.png`);
  await B.click('Accept');
  await B.waitText('Done');
  await B.click('Done');
});
await step('A: board set File Server Stolen → clocks', async () => {
  await A.click('Board');
  await A.waitText('Client File Server');
  await A.click('Client File Server');
  await A.click('Stolen');
  await A.waitText('Texas AG');
  await A.screenshot(`${S}/board-A.png`);
});
await step('chat: A sends, B receives', async () => {
  await A.click('Chat');
  const n = await A.evalJs(`[...document.querySelectorAll('input,textarea')].filter(e=>e.offsetParent!==null).length`);
  await A.type('Unplugging affected machines now', n - 1);
  await A.click('Send');
  await B.click('Chat');
  await B.waitText('Unplugging affected machines now');
});
await step('B: counsel channel visible to Lead', async () => {
  await B.click('Counsel — privileged');
});
await step('A: audit chain verified', async () => {
  await A.click('Team');
  await A.click('Audit timeline');
  await A.waitText('Chain verified');
  await A.screenshot(`${S}/audit-A.png`);
});
console.log('\nA logs:\n' + A.logs.join('\n') + '\nB logs:\n' + B.logs.join('\n'));
process.exit(0);
