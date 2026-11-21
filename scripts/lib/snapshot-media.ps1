$ErrorActionPreference = 'Stop'
$reader = [IO.StreamReader]::new([Console]::OpenStandardInput(), [Text.Encoding]::UTF8)
$jobs = ConvertFrom-Json -InputObject $reader.ReadToEnd()

Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public static class FactoryMediaSnapshot
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(string file, uint access, uint sharing,
        IntPtr security, uint mode, uint flags, IntPtr template);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetFileTime(SafeFileHandle file, IntPtr creation,
        ref ulong access, IntPtr modified);

    public static void Copy(string source, string target)
    {
        const uint GenericRead = 0x80000000;
        const uint WriteAttributes = 0x100;
        const uint ShareRead = 1;
        const uint OpenExisting = 3;
        const uint OpenReparsePoint = 0x00200000;
        using (var handle = CreateFileW(source, GenericRead | WriteAttributes, ShareRead,
            IntPtr.Zero, OpenExisting, OpenReparsePoint, IntPtr.Zero))
        {
            if (handle.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error());
            // FILETIME with both DWORDs set to all ones suppresses atime updates for this handle.
            // It does not set a timestamp on the source. Fail before reading if unsupported.
            ulong suppressAccessTime = ulong.MaxValue;
            if (!SetFileTime(handle, IntPtr.Zero, ref suppressAccessTime, IntPtr.Zero))
                throw new Win32Exception(Marshal.GetLastWin32Error());
            using (var input = new FileStream(handle, FileAccess.Read))
            using (var output = new FileStream(target, FileMode.CreateNew, FileAccess.Write))
                input.CopyTo(output);
        }
    }
}
'@

$failures = @(
for ($index = 0; $index -lt $jobs.Count; $index++) {
    $job = $jobs[$index]
    try {
        [FactoryMediaSnapshot]::Copy([string]$job.source, [string]$job.target)
    } catch {
        [ordered]@{ index = $index; message = "Cannot snapshot without changing access time. $($_.Exception.GetBaseException().Message)" }
    }
}
)
$result = ConvertTo-Json -InputObject $failures -Compress
$writer = [IO.StreamWriter]::new([Console]::OpenStandardOutput(), [Text.UTF8Encoding]::new($false))
$writer.Write($result)
$writer.Flush()
