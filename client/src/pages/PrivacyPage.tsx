import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import { FooterSection } from "@/components/FooterSection";

export default function PrivacyPage() {
  const { i18n } = useTranslation();
  const locale = i18n.language === "es" ? "es" : "en";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        {locale === "es" ? <PrivacyContentES /> : <PrivacyContentEN />}
      </main>
      <FooterSection data={{ type: "footer", copyright_text: "2024 4Geeks. All rights reserved." }} />
    </div>
  );
}

function PrivacyContentEN() {
  return (
    <article className="prose prose-lg dark:prose-invert max-w-none" data-testid="privacy-content">
      <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">Privacy Policy</h1>
      
      <p className="text-muted-foreground mb-6">
        At 4Geeks Academy, accessible from https://4geeksacademy.com, one of our main priorities is the privacy of our visitors and students. This Privacy Policy explains what information we collect, how we use it—including SMS communications— and the choices you have. If you have questions, contact us at privacy@4geeksacademy.com.
      </p>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Log Files</h2>
        <p className="text-muted-foreground">
          4Geeks Academy follows a standard procedure of using log files. These files log visitors when they visit websites. All hosting companies do this as a part of hosting services' analytics. The information collected by log files includes internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and possibly the number of clicks. These are not linked to any information that is personally identifiable. The purpose of the information is for analyzing trends, administering the site, tracking users' movement on the website, and gathering demographic information.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Cookies and Web Beacons</h2>
        <p className="text-muted-foreground">
          Like many websites, 4Geeks Academy uses "cookies" to store information including visitors' preferences and the pages on the website that the visitor accessed or visited. The information is used to optimize the user experience by customizing our web page content based on visitors' browser type and/or other information.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">SMS Communications & Consent (10DLC)</h2>
        <p className="text-muted-foreground mb-4">
          <strong>What we send & why:</strong> If you provide your mobile number, we may send you service-related or informational SMS messages (e.g., enrollment updates, reminders, support notifications). Marketing messages are only sent if you explicitly agree to receive them.
        </p>
        <p className="text-muted-foreground mb-4">
          <strong>How we collect consent:</strong> Consent is obtained through our web forms, checkboxes, enrollment or event registration flows, or when you text us first. Each form clearly states that submitting your number authorizes us to send SMS messages.
        </p>
        <p className="text-muted-foreground mb-4">
          <strong>Opting out:</strong> You can opt out at any time by replying <strong>STOP</strong> to any message. You may receive one final message confirming your opt-out. For help, reply <strong>HELP</strong> or email privacy@4geeksacademy.com.
        </p>
        <p className="text-muted-foreground mb-4">
          <strong>Message & data rates:</strong> Standard message and data rates may apply, and message frequency varies.
        </p>
        <p className="text-muted-foreground">
          <strong>Carrier disclaimer:</strong> Carriers are not liable for delayed or undelivered messages.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">SMS Data Handling & Security</h2>
        <p className="text-muted-foreground mb-2">We treat phone numbers and SMS interaction data as personal information:</p>
        <ul className="list-disc list-inside text-muted-foreground space-y-2">
          <li><strong>No sale or sharing:</strong> We do not sell or share your phone number with third parties for their own marketing.</li>
          <li><strong>Limited access:</strong> Only authorized personnel and service providers (e.g., SMS delivery vendors) can access this data to perform services on our behalf.</li>
          <li><strong>Secure storage:</strong> Data is stored using administrative, technical, and physical safeguards designed to protect it.</li>
          <li><strong>Retention:</strong> We keep SMS-related data only as long as needed to fulfill the purpose for which it was collected or to comply with legal obligations, then delete or anonymize it.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Our Advertising Partners</h2>
        <p className="text-muted-foreground">
          Some advertisers on our site may use cookies and web beacons. Each of our advertising partners has their own Privacy Policy for their policies on user data.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Third Party Privacy Policies</h2>
        <p className="text-muted-foreground">
          4Geeks Academy's Privacy Policy does not apply to other advertisers, messaging providers, or websites. Thus, we advise you to consult the respective Privacy Policies of these third-party services for more detailed information, including how to opt out. You can disable cookies through your individual browser options; instructions can be found at your browser's website.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Children's Information</h2>
        <p className="text-muted-foreground">
          Another part of our priority is adding protection for children while using the internet. We encourage parents and guardians to observe, participate in, and/or monitor and guide their online activity. 4Geeks Academy does not knowingly collect any Personal Identifiable Information from children under the age of 13. If you believe your child provided such information on our website, contact us immediately and we will promptly remove it from our records.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Online Privacy Policy Only</h2>
        <p className="text-muted-foreground">
          This Privacy Policy applies only to our online activities and is valid for visitors to our website with regards to the information that they shared and/or collect on 4Geeks Academy. This policy is not applicable to any information collected offline or via channels other than this website.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Consent</h2>
        <p className="text-muted-foreground">
          By using our website, you consent to this Privacy Policy. By providing your phone number and affirmatively opting in where required, you consent to receive SMS communications as described above and agree to our Terms and Conditions.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Changes to This Policy</h2>
        <p className="text-muted-foreground">
          We may update this Privacy Policy from time to time. We will post the revised version with an updated effective date. Your continued use of the site after any changes signifies your acceptance of the revised policy.
        </p>
      </section>

      <p className="text-sm text-muted-foreground mt-8">
        Last updated: 2025-07-23
      </p>
    </article>
  );
}

function PrivacyContentES() {
  return (
    <article className="prose prose-lg dark:prose-invert max-w-none" data-testid="privacy-content">
      <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">Política de Privacidad</h1>
      
      <p className="text-muted-foreground mb-6">
        En 4Geeks Academy, accesible desde https://4geeksacademy.com, una de nuestras principales prioridades es la privacidad de nuestros visitantes y estudiantes. Esta Política de Privacidad explica qué información recopilamos, cómo la usamos—incluyendo comunicaciones por SMS— y las opciones que tienes. Si tienes preguntas, contáctanos en privacy@4geeksacademy.com.
      </p>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Archivos de Registro</h2>
        <p className="text-muted-foreground">
          4Geeks Academy sigue un procedimiento estándar de uso de archivos de registro. Estos archivos registran a los visitantes cuando visitan sitios web. Todas las empresas de hosting hacen esto como parte del análisis de servicios de hosting. La información recopilada por los archivos de registro incluye direcciones de protocolo de internet (IP), tipo de navegador, Proveedor de Servicios de Internet (ISP), fecha y hora, páginas de referencia/salida, y posiblemente el número de clics. Estos no están vinculados a ninguna información que sea personalmente identificable. El propósito de la información es analizar tendencias, administrar el sitio, rastrear el movimiento de los usuarios en el sitio web y recopilar información demográfica.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Cookies y Web Beacons</h2>
        <p className="text-muted-foreground">
          Como muchos sitios web, 4Geeks Academy usa "cookies" para almacenar información incluyendo las preferencias de los visitantes y las páginas en el sitio web que el visitante accedió o visitó. La información se utiliza para optimizar la experiencia del usuario personalizando el contenido de nuestra página web basándose en el tipo de navegador de los visitantes y/u otra información.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Comunicaciones SMS y Consentimiento (10DLC)</h2>
        <p className="text-muted-foreground mb-4">
          <strong>Qué enviamos y por qué:</strong> Si proporcionas tu número de móvil, podemos enviarte mensajes SMS relacionados con el servicio o informativos (por ejemplo, actualizaciones de inscripción, recordatorios, notificaciones de soporte). Los mensajes de marketing solo se envían si aceptas explícitamente recibirlos.
        </p>
        <p className="text-muted-foreground mb-4">
          <strong>Cómo recopilamos el consentimiento:</strong> El consentimiento se obtiene a través de nuestros formularios web, casillas de verificación, flujos de inscripción o registro de eventos, o cuando nos envías un mensaje de texto primero. Cada formulario indica claramente que enviar tu número nos autoriza a enviar mensajes SMS.
        </p>
        <p className="text-muted-foreground mb-4">
          <strong>Darse de baja:</strong> Puedes darte de baja en cualquier momento respondiendo <strong>STOP</strong> a cualquier mensaje. Puedes recibir un mensaje final confirmando tu baja. Para ayuda, responde <strong>HELP</strong> o envía un correo a privacy@4geeksacademy.com.
        </p>
        <p className="text-muted-foreground mb-4">
          <strong>Tarifas de mensajes y datos:</strong> Pueden aplicar tarifas estándar de mensajes y datos, y la frecuencia de mensajes varía.
        </p>
        <p className="text-muted-foreground">
          <strong>Descargo de responsabilidad del operador:</strong> Los operadores no son responsables de mensajes retrasados o no entregados.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Manejo y Seguridad de Datos SMS</h2>
        <p className="text-muted-foreground mb-2">Tratamos los números de teléfono y los datos de interacción SMS como información personal:</p>
        <ul className="list-disc list-inside text-muted-foreground space-y-2">
          <li><strong>Sin venta ni compartir:</strong> No vendemos ni compartimos tu número de teléfono con terceros para su propio marketing.</li>
          <li><strong>Acceso limitado:</strong> Solo el personal autorizado y los proveedores de servicios (por ejemplo, proveedores de entrega de SMS) pueden acceder a estos datos para realizar servicios en nuestro nombre.</li>
          <li><strong>Almacenamiento seguro:</strong> Los datos se almacenan utilizando salvaguardas administrativas, técnicas y físicas diseñadas para protegerlos.</li>
          <li><strong>Retención:</strong> Mantenemos los datos relacionados con SMS solo el tiempo necesario para cumplir con el propósito para el cual fueron recopilados o para cumplir con obligaciones legales, luego los eliminamos o anonimizamos.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Nuestros Socios Publicitarios</h2>
        <p className="text-muted-foreground">
          Algunos anunciantes en nuestro sitio pueden usar cookies y web beacons. Cada uno de nuestros socios publicitarios tiene su propia Política de Privacidad para sus políticas sobre datos de usuarios.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Políticas de Privacidad de Terceros</h2>
        <p className="text-muted-foreground">
          La Política de Privacidad de 4Geeks Academy no se aplica a otros anunciantes, proveedores de mensajería o sitios web. Por lo tanto, te aconsejamos que consultes las respectivas Políticas de Privacidad de estos servicios de terceros para obtener información más detallada, incluyendo cómo darse de baja. Puedes desactivar las cookies a través de las opciones de tu navegador individual; las instrucciones se pueden encontrar en el sitio web de tu navegador.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Información de Menores</h2>
        <p className="text-muted-foreground">
          Otra parte de nuestra prioridad es agregar protección para los niños mientras usan internet. Animamos a los padres y tutores a observar, participar y/o monitorear y guiar su actividad en línea. 4Geeks Academy no recopila conscientemente ninguna Información Personal Identificable de niños menores de 13 años. Si crees que tu hijo proporcionó dicha información en nuestro sitio web, contáctanos inmediatamente y la eliminaremos rápidamente de nuestros registros.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Política de Privacidad Solo en Línea</h2>
        <p className="text-muted-foreground">
          Esta Política de Privacidad se aplica solo a nuestras actividades en línea y es válida para los visitantes de nuestro sitio web con respecto a la información que compartieron y/o recopilamos en 4Geeks Academy. Esta política no es aplicable a ninguna información recopilada fuera de línea o a través de canales distintos a este sitio web.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Consentimiento</h2>
        <p className="text-muted-foreground">
          Al usar nuestro sitio web, consientes esta Política de Privacidad. Al proporcionar tu número de teléfono y optar afirmativamente donde sea requerido, consientes recibir comunicaciones SMS como se describe anteriormente y aceptas nuestros Términos y Condiciones.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Cambios a Esta Política</h2>
        <p className="text-muted-foreground">
          Podemos actualizar esta Política de Privacidad de vez en cuando. Publicaremos la versión revisada con una fecha de vigencia actualizada. Tu uso continuado del sitio después de cualquier cambio significa tu aceptación de la política revisada.
        </p>
      </section>

      <p className="text-sm text-muted-foreground mt-8">
        Última actualización: 2025-07-23
      </p>
    </article>
  );
}
