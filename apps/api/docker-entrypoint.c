#define _DEFAULT_SOURCE
#define _XOPEN_SOURCE 700

#include <errno.h>
#include <ftw.h>
#include <grp.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

#define APP_UID ((uid_t)10001)
#define APP_GID ((gid_t)10001)

static int prepare_archive_root(const char *root) {
    static const char prefix[] = "/data/";
    if (strncmp(root, prefix, sizeof(prefix) - 1) != 0) {
        return -1;
    }

    const char *leaf = root + sizeof(prefix) - 1;
    if (*leaf == '\0' || strcmp(leaf, ".") == 0 || strcmp(leaf, "..") == 0 ||
        strchr(leaf, '/') != NULL) {
        return -1;
    }

    struct stat metadata;
    if (lstat(root, &metadata) == 0) {
        return S_ISDIR(metadata.st_mode) ? 0 : -1;
    }
    if (errno != ENOENT) {
        return -1;
    }
    return mkdir(root, 0750);
}

static const int WALK_FLAGS = FTW_PHYS | FTW_DEPTH;

static int repair_owner(
    const char *path,
    const struct stat *metadata,
    int kind,
    struct FTW *walk
) {
    (void)metadata;
    (void)kind;
    (void)walk;
    return lchown(path, APP_UID, APP_GID);
}

static int repair_archive_tree(const char *root) {
    return nftw(root, repair_owner, 32, WALK_FLAGS);
}

static int drop_privileges(void) {
    if (setgroups(0, NULL) != 0 || setgid(APP_GID) != 0 || setuid(APP_UID) != 0) {
        return -1;
    }
    return geteuid() == APP_UID && getegid() == APP_GID ? 0 : -1;
}

static bool is_app_user(void) {
    return geteuid() == APP_UID && getegid() == APP_GID;
}

static bool is_healthcheck(int argc, char **argv) {
    return argc >= 3 && strcmp(argv[argc - 1], "healthcheck") == 0;
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fputs("convexa-entrypoint: command required\n", stderr);
        return 64;
    }

    if (geteuid() == 0) {
        const char *archive_root = getenv("SESSION_CHAIN_ARCHIVE_BODY_ROOT");
        if (!is_healthcheck(argc, argv) && archive_root != NULL && *archive_root != '\0') {
            if (prepare_archive_root(archive_root) != 0 ||
                repair_archive_tree(archive_root) != 0) {
                fputs("convexa-entrypoint: archive volume ownership repair failed\n", stderr);
                return 78;
            }
        }

        if (drop_privileges() != 0) {
            fputs("convexa-entrypoint: privilege drop failed\n", stderr);
            return 77;
        }
    } else if (!is_app_user()) {
        fputs("convexa-entrypoint: unexpected runtime identity\n", stderr);
        return 77;
    }

    execvp(argv[1], &argv[1]);
    fputs("convexa-entrypoint: command exec failed\n", stderr);
    return 127;
}
