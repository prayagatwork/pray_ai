#include <ApplicationServices/ApplicationServices.h>
#include <stdio.h>
#include <string.h>
#include <signal.h>

static int hidden = 0;

void cleanup(int sig) {
    if (hidden) {
        CGDisplayShowCursor(CGMainDisplayID());
    }
    _exit(0);
}

int main() {
    signal(SIGTERM, cleanup);
    signal(SIGINT, cleanup);
    signal(SIGHUP, cleanup);

    setbuf(stdin, NULL);
    setbuf(stdout, NULL);

    char buf[32];
    while (fgets(buf, sizeof(buf), stdin)) {
        if (strncmp(buf, "hide", 4) == 0 && !hidden) {
            CGDisplayHideCursor(CGMainDisplayID());
            hidden = 1;
        } else if (strncmp(buf, "show", 4) == 0 && hidden) {
            CGDisplayShowCursor(CGMainDisplayID());
            hidden = 0;
        }
    }

    if (hidden) {
        CGDisplayShowCursor(CGMainDisplayID());
    }

    return 0;
}
