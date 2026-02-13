import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import { FooterSection } from "@/components/FooterSection";

export default function TermsPage() {
  const { i18n } = useTranslation();
  const locale = i18n.language === "es" ? "es" : "en";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        {locale === "es" ? <TermsContentES /> : <TermsContentEN />}
      </main>
      <FooterSection data={{ type: "footer", copyright_text: "2024 4Geeks. All rights reserved." }} />
    </div>
  );
}

function TermsContentEN() {
  return (
    <article className="prose prose-lg dark:prose-invert max-w-none" data-testid="terms-content">
      <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">Terms and Conditions</h1>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Website Owner</h2>
        <p className="text-muted-foreground mb-4">
          <strong>Identity:</strong> 4GEEKS ACADEMY, LLC (hereinafter, "4GEEKS")
        </p>
        <p className="text-muted-foreground mb-4">
          <strong>Contact Address:</strong> 1801 SW 3rd Ave #100, Miami, FL 33129
        </p>
        <p className="text-muted-foreground mb-4">
          <strong>Contact Email:</strong> info@4GeeksAcademy.com
        </p>
        <p className="text-muted-foreground">
          <strong>EIN:</strong> 47-1915589
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Purpose, Scope of Application and Duration</h2>
        <p className="text-muted-foreground mb-4">
          This Legal Notice governs the use of the Website, as well as access to it, navigation and, in general, the relationship between the Website owner and any person who accesses it (hereinafter, referred to individually as the "User" or collectively as the "Users").
        </p>
        <p className="text-muted-foreground mb-4">
          The Website provides Users with general information about 4GEEKS and its activities (hereinafter, the "Content"), all in accordance with this Legal Notice. As it is a professional page, its content is not aimed at Users who are minors.
        </p>
        <p className="text-muted-foreground mb-4">
          4GEEKS reserves the right to modify, at any time and without prior notice, the presentation, configuration and content of the Website or the conditions required for its access and/or use, as well as to interrupt, suspend or terminate access to the content of the Website, without the possibility for the User to demand any compensation.
        </p>
        <p className="text-muted-foreground">
          Access, navigation and use of the Website by a User implies the express and unreserved acceptance of all the terms of this Legal Notice and any special conditions, having the same validity and effectiveness as any contract entered into in writing and signed.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Access</h2>
        <p className="text-muted-foreground mb-4">
          Use of the Website is free of charge, notwithstanding the cost of connection through the corresponding telecommunications network that the User may incur to access it.
        </p>
        <p className="text-muted-foreground">
          4GEEKS is not responsible for any damage or harm of any kind caused to the User arising from failures or disconnections in telecommunications networks that cause the suspension, cancellation or interruption of access to the Website.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Terms of Use</h2>
        <p className="text-muted-foreground mb-4">
          The main purpose of these Terms of Use is to regulate access to the Website. Those who access the Website freely are obliged to observe them. Access and navigation through the Website implies their express and unreserved acceptance.
        </p>
        <p className="text-muted-foreground mb-4">
          Those who access the Website must scrupulously observe the applicable legislation, ethical codes and the Terms of Use of the Website.
        </p>
        <p className="text-muted-foreground">
          Excessive or abusive use of the Website may result in denial of access to it. Excessive and/or abusive use shall be considered to be any use that goes against the general principles of good faith, morality and public order, that causes or may cause any damage to the Website and/or to third parties as well as to their respective interests, including copyright, and behavior aimed at disabling or impairing the functioning and usability of the Website as well as those that violate any specific instruction and/or warning that has been communicated by 4GEEKS or personnel designated by 4GEEKS for this purpose.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Intellectual and Industrial Property Rights</h2>
        <p className="text-muted-foreground mb-4">
          4GEEKS owns the intellectual and industrial property exploitation rights of the Website including all Content and elements thereof (by way of example, texts, images, audio and videos) available from the Website, as well as those hosted on third party sites either because they are owned by 4GEEKS or because 4GEEKS has obtained the appropriate rights for their use. Likewise, 4GEEKS has obtained the appropriate authorizations relating to image rights of those who appear on its Website.
        </p>
        <p className="text-muted-foreground mb-4">
          The trademarks incorporated in the Website are owned by 4GEEKS or third parties, with authorization for their use on the Website. Those who browse the Website are prohibited from using such trademarks, logos and distinctive signs without the authorization of the owner or the license to use them.
        </p>
        <p className="text-muted-foreground">
          Total or partial reproduction, copying or distribution of the Content is prohibited without the express authorization of 4GEEKS. In no case shall access and navigation by the User imply a waiver, transmission, license or total or partial transfer of such rights by 4GEEKS. Likewise, it is prohibited to modify, copy, reuse, exploit, reproduce, publicly communicate, transmit, use, process or distribute in any way all or part of the Content and elements of the Website for public or commercial purposes, without the express and written authorization of 4GEEKS.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Applicable Law and Jurisdiction</h2>
        <p className="text-muted-foreground mb-4">
          This Legal Notice has been drafted and is governed in accordance with the laws of the State of Florida, United States of America. Due to the supranational nature of electronic communications infrastructures, those who access the Website from other countries must also observe the applicable legislation enacted by each state, to the extent that the same are mandatorily applicable.
        </p>
        <p className="text-muted-foreground">
          For the resolution of any controversy and/or discrepancy that may arise in relation to the existence, validity, interpretation, application, execution, breach or nullity of this Legal Notice, the mandatory rules on applicable legislation and competent jurisdiction shall apply.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Job Placement Guarantee</h2>
        <p className="text-muted-foreground">
          For detailed information on the conditions of our job placement guarantee, please consult our specific document on this matter.
        </p>
      </section>
    </article>
  );
}

function TermsContentES() {
  return (
    <article className="prose prose-lg dark:prose-invert max-w-none" data-testid="terms-content">
      <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">Términos y Condiciones</h1>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Titular del Sitio Web</h2>
        <p className="text-muted-foreground mb-4">
          <strong>Identidad:</strong> 4GEEKS ACADEMY, S.L.L. (en adelante, "4GEEKS")
        </p>
        <p className="text-muted-foreground mb-4">
          <strong>Domicilio de contacto:</strong> 1801 SW 3rd Ave #100, Miami, FL 33129
        </p>
        <p className="text-muted-foreground mb-4">
          <strong>E-mail de contacto:</strong> info@4GeeksAcademy.com
        </p>
        <p className="text-muted-foreground mb-4">
          <strong>CIF/NIF:</strong> nº 47-1915589
        </p>
        <p className="text-muted-foreground">
          4Geeks Academy España S.L. Constituida mediante escritura otorgada en Madrid, el día 27 de enero de 2.020, ante mí, bajo el número 451 de protocolo; Inscrita en el Registro Mercantil de Madrid, al Tomo 40163, Folio 150, Hoja M-713651, Inscripción 1a; Provista de CIF B88579495
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Objeto, Ámbito de Aplicación y Duración</h2>
        <p className="text-muted-foreground mb-4">
          El presente Aviso Legal regula el uso del Sitio Web, así como su acceso, navegación y, en general, la relación del titular del Sitio Web con cualquier persona que accede al mismo (en adelante, referido de forma individual como el "Usuario" o de forma colectiva como los "Usuarios").
        </p>
        <p className="text-muted-foreground mb-4">
          El Sitio Web proporciona a los Usuarios información general acerca de 4GEEKS y de sus actividades (en adelante, el "Contenido"), todo ello de acuerdo con el presente Aviso Legal. Al tratarse de una página profesional, su contenido no está dirigido a Usuarios que sean menores de edad.
        </p>
        <p className="text-muted-foreground mb-4">
          4GEEKS se reserva el derecho de modificar, en cualquier momento y sin necesidad de previo aviso, la presentación, configuración y contenido del Sitio Web o las condiciones requeridas para su acceso y/o utilización, así como interrumpir, suspender o dar por terminado el acceso al contenido del Sitio Web, sin posibilidad por parte del Usuario de exigir indemnización alguna.
        </p>
        <p className="text-muted-foreground">
          El acceso, la navegación y la utilización del Sitio Web por un Usuario implica la aceptación expresa y sin reservas de todos los términos del presente Aviso Legal y las eventuales condiciones particulares, teniendo la misma validez y eficacia que cualquier contrato celebrado por escrito y firmado.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Acceso</h2>
        <p className="text-muted-foreground mb-4">
          El uso del Sitio Web tendrá carácter gratuito, sin perjuicio del coste de conexión a través de la correspondiente red de telecomunicaciones que para el Usuario tenga el acceso al mismo.
        </p>
        <p className="text-muted-foreground">
          4GEEKS no se responsabiliza de los daños o perjuicios de cualquier tipo producidos en el Usuario que traigan causa de fallos o desconexiones en las redes de telecomunicaciones que produzcan la suspensión, cancelación o interrupción del acceso al Sitio Web.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Condiciones de Uso</h2>
        <p className="text-muted-foreground mb-4">
          La finalidad principal de estas Condiciones de Uso es regular el acceso al Sitio Web. Quienes acceden de forma libre al Sitio Web quedan obligados a observarlas. El acceso y navegación por el Sitio Web implica la aceptación de las mismas de forma expresa y sin reservas.
        </p>
        <p className="text-muted-foreground mb-4">
          Quienes acceden al Sitio Web deben observar la legislación aplicable, los códigos éticos y las Condiciones de Uso del Sitio Web escrupulosamente.
        </p>
        <p className="text-muted-foreground">
          El uso excesivo o abusivo del Sitio Web puede tener como consecuencia la denegación del acceso al mismo. Se considerará como uso excesivo y/o abusivo, todo aquel que vaya en contra de los principios generales de la buena fe, la moral y el orden público, el que cause o pueda causar algún daño al Sitio Web y/o a terceros así como a sus respectivos intereses, incluido el derecho de autor, y los comportamientos encaminados a deshabilitar o deteriorar el funcionamiento y la usabilidad del Sitio Web así como aquellos que conculquen cualquier instrucción específica y/o advertencia que se hubiera comunicado.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Derechos de Propiedad Intelectual e Industrial</h2>
        <p className="text-muted-foreground mb-4">
          4GEEKS es titular de los derechos de explotación de propiedad intelectual e industrial del Sitio Web incluyendo todos los Contenidos y elementos del mismo (a título enunciativo, textos, imágenes, audio y videos) disponibles desde el Sitio Web, así como de los que haya alojado en sitios de terceros bien porque son de su propiedad, bien porque ha obtenido los derechos oportunos para su utilización. Igualmente, 4GEEKS ha obtenido las autorizaciones oportunas relativas a derechos de imagen de quienes aparecen en su Sitio Web.
        </p>
        <p className="text-muted-foreground mb-4">
          Las marcas incorporadas en el Sitio Web son titularidad de 4GEEKS o de terceros, contando con la autorización para su uso en el Sitio Web. Quienes navegan por el Sitio Web tienen prohibido utilizar dichas marcas, logos y signos distintivos sin la autorización del titular o la licencia de uso de las mismas.
        </p>
        <p className="text-muted-foreground">
          Queda prohibida la reproducción total o parcial, copia o distribución del Contenido, sin autorización expresa por parte de 4GEEKS. En ningún caso se entenderá que el acceso y navegación del Usuario, implica una renuncia, transmisión, licencia o cesión total ni parcial de dichos derechos por parte de 4GEEKS. Asimismo, está prohibido modificar, copiar, reutilizar, explotar, reproducir, comunicar públicamente, transmitir, usar, tratar o distribuir de cualquier forma la totalidad o parte de los Contenidos y elementos del Sitio Web para propósitos públicos o comerciales, si no se cuenta con la autorización expresa y por escrito de 4GEEKS.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Jurisdicción Competente y Ley Aplicable</h2>
        <p className="text-muted-foreground mb-4">
          El presente Aviso Legal ha sido redactado y se rige de acuerdo con la legislación española. Debido al carácter supranacional de las infraestructuras de comunicaciones electrónicas, quienes acceden desde otros países al Sitio Web deben observar asimismo la legislación aplicable promulgada por cada estado, en la medida en la que las mismas resulten de aplicación imperativa.
        </p>
        <p className="text-muted-foreground">
          Para la resolución de cualquier controversia y/o discrepancia que pudiera surgir en relación con la existencia, validez, interpretación, aplicación, ejecución, incumplimiento o nulidad del presente Aviso Legal se aplicarán las normas imperativas sobre legislación aplicable y jurisdicción competente.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-4">Garantía de Empleo</h2>
        <p className="text-muted-foreground">
          Para obtener información detallada sobre las condiciones de nuestra garantía de empleo, por favor consulte nuestro documento específico al respecto.
        </p>
      </section>
    </article>
  );
}
