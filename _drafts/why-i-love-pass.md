---
tile: pass as my main password manager
layout: post
tags: [Tutorials]
---

pass is a simple, yet powerful password manager - i mainly use it via terminal but it has also a GUI frontend. It uses GPG and Git to encrypt and store my passwords.
In this article i will showcase why i love it.

<!-- more -->

# Your first steps

[pass](https://www.passwordstore.org/) is the standard unix password manager and therefore keeps things simple -so it suits my workflow based on [dwm](https://github.com/dme86/dwm) or [neovim](https://github.com/dme86/neovim).

On my machine i can initialize the password store via:

    pass init "me.daniel.meier"

and in this case `me.daniel.meier` is also my GPG ID.

To store a password i can now just type:

    pass insert test/foo

A prompt will appear and i have to enter my password for *test/foo* two times.
If i don't have a password yet, pass is also able to create one for me:

    pass generate test/foo 15

this would generate a password for test/foo of 15 characters (or 25 if unspecified).
It is possible to create a password with no symbols via *--no-symbols* or *-n*.
You could also use `--clip` or `-c` to copy it to the [clipboard](https://wiki.archlinux.org/title/clipboard) instead of displaying it at the console.

It is also possible to do multiline insert for your new password via:

    pass insert test/foo -m

And of course you are able to edit your passwords in your [favourite editor](https://github.com/dme86/neovim) via:

    pass edit test/foo

Of course passwords can also be deleted:

    pass rm test/multiline

 or moved `pass mv [--force,-f] old-path new-path`.

# Git


# fish

grep some argument eg. url, username etc.
````shell
function passgrep
    set entry $argv[1]
    set part $argv[2]

    # Use pass command to retrieve the password, grep for the specified part, and format the output
    set result (pass $entry | grep $part | cut -d ':' -f 2,3 | awk '{$1=$1;print}')

    # Check if the result is empty
    if test -n "$result"
        # Copy the result to the clipboard
        echo $result | xclip -sel clip
        echo "$part for '$entry' copied to clipboard."
    else
        # Print a message indicating that the entry or part was not found
        echo "Error: '$entry' or '$part' not found."
    end
end
````

Completition:

```shell
set PROG 'pass'

function __fish_pass_get_prefix
    set -l prefix "$PASSWORD_STORE_DIR"
    if [ -z "$prefix" ]
        set prefix "$HOME/.password-store"
    end
    echo "$prefix"
end

function __fish_pass_needs_command
    set -l cmd (commandline -opc)
    if [ (count $cmd) -eq 1 -a $cmd[1] = $PROG ]
        return 0
    end
    return 1
end
function __fish_pass_uses_command
    set cmd (commandline -opc)
    if [ (count $cmd) -gt 1 ]
        if [ $argv[1] = $cmd[2] ]
            return 0
        end
    end
    return 1
end

function __fish_pass_print_gpg_keys
    gpg2 --list-keys | grep uid | sed 's/.*<\(.*\)>/\1/'
end
function __fish_pass_print_entry_dirs
    set -l prefix (__fish_pass_get_prefix)
    set -l dirs
    eval "set dirs "$prefix"/**/"
    for dir in $dirs
        set entry (echo "$dir" | sed "s#$prefix/\(.*\)#\1#")
        echo "$entry"
    end
end
function __fish_pass_print_entries
    set -l prefix (__fish_pass_get_prefix)
    set -l files
    eval "set files "$prefix"/**.gpg"
    for file in $files
        set file (echo "$file" | sed "s#$prefix/\(.*\)\.gpg#\1#")
        echo "$file"
    end
end
function __fish_pass_print_entries_and_dirs
    __fish_pass_print_entry_dirs
    __fish_pass_print_entries
end


complete -c $PROG -e
complete -c $PROG -f -A -n '__fish_pass_needs_command' -a help -d 'Command: show usage help'
complete -c $PROG -f -A -n '__fish_pass_needs_command' -a version -d 'Command: show program version'

complete -c $PROG -f -A -n '__fish_pass_needs_command' -a init -d 'Command: initialize new password storage'
complete -c $PROG -f -A -n '__fish_pass_uses_command init' -s e -l reencrypt -d 'Reencrypt existing passwords using new gpg-id'
complete -c $PROG -f -A -n '__fish_contains_opt -s e reencrypt' -a '(__fish_pass_print_gpg_keys)'

complete -c $PROG -f -A -n '__fish_pass_needs_command' -a ls -d 'Command: list passwords'
complete -c $PROG -f -A -n '__fish_pass_uses_command ls' -a "(__fish_pass_print_entry_dirs)"

complete -c $PROG -f -A -n '__fish_pass_needs_command' -a insert -d 'Command: insert new password'
complete -c $PROG -f -A -n '__fish_pass_uses_command insert' -s e -l echo -d 'Echo the password on console'
complete -c $PROG -f -A -n '__fish_pass_uses_command insert' -s m -l multiline -d 'Provide multiline password entry'
complete -c $PROG -f -A -n '__fish_pass_uses_command insert' -s f -l force -d 'Do not prompt before overwritting'
complete -c $PROG -f -A -n '__fish_pass_uses_command insert' -a "(__fish_pass_print_entry_dirs)"

complete -c $PROG -f -A -n '__fish_pass_needs_command' -a generate -d 'Command: generate new password'
complete -c $PROG -f -A -n '__fish_pass_uses_command generate' -s n -l no-symbols -d 'Do not use special symbols'
complete -c $PROG -f -A -n '__fish_pass_uses_command generate' -s c -l clip -d 'Put the password in clipboard'
complete -c $PROG -f -A -n '__fish_pass_uses_command generate' -s f -l force -d 'Do not prompt before overwritting'
complete -c $PROG -f -A -n '__fish_pass_uses_command generate' -a "(__fish_pass_print_entry_dirs)"

complete -c $PROG -f -A -n '__fish_pass_needs_command' -a rm -d 'Command: remove existing password'
complete -c $PROG -f -A -n '__fish_pass_uses_command rm' -s r -l recursive -d 'Remove password groups recursively'
complete -c $PROG -f -A -n '__fish_pass_uses_command rm' -s f -l force -d 'Force removal'
complete -c $PROG -f -A -n '__fish_pass_uses_command rm' -a "(__fish_pass_print_entries_and_dirs)"

complete -c $PROG -f -A -n '__fish_pass_needs_command' -a edit -d 'Command: edit password using text editor'
complete -c $PROG -f -A -n '__fish_pass_uses_command edit' -a "(__fish_pass_print_entries)"

complete -c $PROG -f -A -n '__fish_pass_needs_command' -a show -d 'Command: show existing password'
complete -c $PROG -f -A -n '__fish_pass_uses_command show' -s c -l clip -d 'Put password in clipboard'
complete -c $PROG -f -A -n '__fish_pass_uses_command show' -a "(__fish_pass_print_entries)"
# When no command is given, `show` is defaulted.
complete -c $PROG -f -A -n '__fish_pass_needs_command' -s c -l clip -d 'Put password in clipboard'
complete -c $PROG -f -A -n '__fish_pass_needs_command' -a "(__fish_pass_print_entries)"
complete -c $PROG -f -A -n '__fish_pass_uses_command -c' -a "(__fish_pass_print_entries)"
complete -c $PROG -f -A -n '__fish_pass_uses_command --clip' -a "(__fish_pass_print_entries)"

complete -c $PROG -f -A -n '__fish_pass_needs_command' -a git -d 'Command: execute a git command'
complete -c $PROG -f -A -n '__fish_pass_uses_command git' -a 'init' -d 'Initialize git repository'
complete -c $PROG -f -A -n '__fish_pass_uses_command git' -a 'push' -d 'Push changes to remote repo'
complete -c $PROG -f -A -n '__fish_pass_uses_command git' -a 'pull' -d 'Pull changes from remote repo'
complete -c $PROG -f -A -n '__fish_pass_uses_command git' -a 'log' -d 'View changelog'
```
