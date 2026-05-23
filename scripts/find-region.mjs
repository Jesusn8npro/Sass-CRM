import postgres from "postgres";

const regions = ["us-east-1","us-east-2","us-west-1","us-west-2","eu-central-1","eu-west-1","ap-southeast-1","sa-east-1","ca-central-1"];
const ref = "hecrpmywujicgwcqmxbp";
const password = "97080407746Joshua";

for (const region of regions) {
  const db = postgres({
    host: `aws-0-${region}.pooler.supabase.com`,
    port: 6543,
    database: "postgres",
    user: `postgres.${ref}`,
    password,
    ssl: "require",
    max: 1,
    prepare: false,
    connect_timeout: 5,
  });
  try {
    const [r] = await db`SELECT 1 as ok`;
    console.log(`✅ FOUND in ${region}`);
    await db.end();
    break;
  } catch (e) {
    console.log(`❌ ${region}: ${e.message.slice(0,60)}`);
    await db.end({ timeout: 1 });
  }
}
