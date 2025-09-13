import { Component, signal } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-header-options-list',
  imports: [NgClass],
  templateUrl: './header-options-list.component.html',
  styleUrl: './header-options-list.component.scss'
})
export class HeaderOptionsListComponent {
  isMessages = signal<boolean>(false);
  isNotifications = signal<boolean>(false);
  isProfileOpen = signal<boolean>(false);
  setMessages(value?: boolean) {
    this.isMessages.set(value ?? !this.isMessages());
  }
  setNotifications(value?: boolean) {
    this.isNotifications.set(value ?? !this.isNotifications());
  }
  setProfileOpen(value?: boolean) {
    this.isProfileOpen.set(value ?? !this.isProfileOpen());
  }
  toggleNotificationDropdown() {
    this.setMessages(false);
    this.setProfileOpen(false);
    this.setNotifications();
  }
  toggleMessagesDropdown() {
    this.setMessages();
    this.setNotifications(false);
    this.setProfileOpen(false);
  }
  toggleProfileDropdown() {
    this.setProfileOpen();
    this.setMessages(false);
    this.setNotifications(false);
  }

  toggleFullscreen() {
    // event.preventDefault();
    const doc: any = document;
    const docEl: any = document.documentElement;

    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
      if (docEl.requestFullscreen) {
          docEl.requestFullscreen();
        } else if (docEl.msRequestFullscreen) {
          docEl.msRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          docEl.mozRequestFullScreen();
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        }
    } else {
      if (doc.exitFullscreen) {
          doc.exitFullscreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          doc.mozCancelFullScreen();
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        }
    }
  }

}
