import { describe, expect, it } from "vitest";
import { parseEnvironmentSnapshot } from "./snapshot";

describe("environment snapshot parser", () => {
  it("extracts stable operating system facts", () => {
    const parsed = parseEnvironmentSnapshot(`
Static hostname: server-01
PRETTY_NAME="Kylin Linux Advanced Server V10"
Architecture: x86_64
Linux server-01 4.19.90-89.11.v2401.ky10.x86_64
eth0 UP 192.168.10.21/24
Mem: 31Gi 4Gi 22Gi
Filesystem Type Size Used Avail Use% Mounted on
/dev/sda2 xfs 100G 30G 70G 30% /
`);
    expect(parsed.facts.hostname).toBe("server-01");
    expect(parsed.facts.operatingSystem).toContain("Kylin");
    expect(parsed.facts.privateIpv4).toBe("192.168.10.21");
  });

  it("marks multiple private addresses as a conflict", () => {
    const parsed = parseEnvironmentSnapshot("host-01\nPRETTY_NAME=Rocky Linux 9\nx86_64\n192.168.1.20/24\n10.0.0.20/24");
    expect(parsed.status).toBe("conflict");
    expect(parsed.conflictingFacts[0]).toContain("多个内网 IPv4");
  });
});
