'use client';

import { useEffect } from 'react';

import { bootAios } from '@/lib/aios';

import IconSprite from './IconSprite';
import TopBar from './TopBar';
import Nav from './Nav';
import SidePanel from './SidePanel';
import AskBar from './AskBar';
import Overlays from './Overlays';

import ExecutiveView from './views/ExecutiveView';
import AcquisitionView from './views/AcquisitionView';
import CreativeView from './views/CreativeView';
import ConversionView from './views/ConversionView';
import ConversationView from './views/ConversationView';
import SalesView from './views/SalesView';
import IcpView from './views/IcpView';
import ContactsView from './views/ContactsView';
import SetterView from './views/SetterView';
import CloserView from './views/CloserView';

export default function CommandCenter() {
  /* React sólo pinta el esqueleto; el contenido de cada vista lo sigue
     rellenando la capa imperativa portada del HTML, igual que antes. */
  useEffect(() => {
    bootAios();
  }, []);

  return (
    <>
      <IconSprite />

      <div className="app">
        <TopBar />
        <Nav />

        <main className="main">
          <ExecutiveView />
          <AcquisitionView />
          <CreativeView />
          <ConversionView />
          <ConversationView />
          <SalesView />
          <IcpView />
          <ContactsView />
          <SetterView />
          <CloserView />
        </main>

        <SidePanel />
        <AskBar />
      </div>

      <Overlays />
    </>
  );
}
